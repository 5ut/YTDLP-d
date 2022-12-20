const crypto = require("crypto")
const Logger = require("./logger")
const db = require("./database")

//Simple class representing a download request
//Hosts a logger
class DownloadRequest{
    #downloadId
    #options
    #skip
    #logger
    #finishedPromise
    #finishedPromiseResolve
    #finishedPromiseReject

    constructor(options){
        this.#setValues(options)
    }

    done(){
        this.#finishedPromiseResolve()
    }

    fail(error){
        this.#finishedPromiseReject(error)
    }

    #setValues(options){
        this.#downloadId = crypto.randomUUID()
        this.#options = structuredClone(options)
        this.#skip = false
        this.#logger = new Logger()
        this.#finishedPromise = new Promise((resolve,reject)=>{
            this.#finishedPromiseResolve = resolve
            this.#finishedPromiseReject = reject
        })
    }

    get downloadId(){
        return this.#downloadId
    }

    get options(){
        return this.#options
    }

    setSkip(){
        this.#skip = true
    }

    setUnskip(){
        this.#skip = false
    }

    get skip(){
        return this.#skip
    }

    get logger(){
        return this.#logger
    }

    get finishedPromise(){
        return this.#finishedPromise
    }

    //An object that users can interact with
    get userObject(){
        return {
            downloadId: this.downloadId,
            finished: this.finishedPromise,
            errorStream: this.logger.errorStream,
            infoStream: this.logger.infoStream 
        }
    }
}

class VideoDownloadRequest extends DownloadRequest{
    #videoId

    constructor(options, videoId){
        super(options)
        this.#setValues(videoId)
        this.#setDatabase()
        this.#saveOptions()
    }

    async done(){
        await this.#storeLogs()
        this.logger.close()
        await this.#markDatabaseComplete()
        super.done()
    }

    async fail(error){
        await this.logger.error(error)
        await this.#storeLogs()
        this.logger.close()
        super.fail(error)
    }

    async #setDatabase(){
        try{
            await db.query("INSERT INTO video_download(download_id, video_id, completed) VALUES (?, ?, 0)", [super.downloadId, this.videoId])
        }catch(err){
            super.logger.error("Failed to setup download request DB: "+err)
        }
    }

    async #saveOptions(){
        try{
            await db.query("INSERT INTO video_download_options(download_id, options) VALUES (?, ?)", [super.downloadId, JSON.stringify(super.options)])
        }catch(err){
            super.logger.error("Failed to setup download request DB: "+err)
        }
    }

    async #markDatabaseComplete(){
        try{
            await db.query("UPDATE `video_download` SET `completed` = '1' WHERE `download_id` = ?", [super.downloadId])
        }catch(err){
            super.logger.error("Failed to setup download request DB: "+err)
        }
    }

    async #storeLogs(){
        try{
            await db.query("INSERT INTO video_download_logs(download_id, info_log, error_log, debug_log) VALUES (?, ?, ?, ?)", [super.downloadId, JSON.stringify(super.logger.infoLogs), JSON.stringify(super.logger.errorLogs), JSON.stringify(super.logger.debugLogs)])
        }catch(err){
            super.logger.error("Failed to save logs: "+err)
        }
    }

    #setValues(videoId){
        this.#videoId = videoId
    }

    get videoId(){
        return this.#videoId
    }
}

class GeneralDownloadRequest extends DownloadRequest{
    #url

    constructor(options, url){
        super(options)
        this.#setValues(url)
    }

    #setValues(url){
        this.#url = url
    }

    get url(){
        return this.#url
    }
}

module.exports = {VideoDownloadRequest: VideoDownloadRequest, GeneralDownloadRequest: GeneralDownloadRequest}