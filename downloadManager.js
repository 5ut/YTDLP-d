//Manages all downloads
//Keep DB updated, moves files, and manages download requests
const downloadOptions = require("./downloadOptions")
const storage = require("./filesystem")
const dlProcessor = require("./downloadProcessor")
const db = require("./database")
const {VideoDownloadRequest, GeneralDownloadRequest} = require("./downloadRequest")
const { validUrl, urlType, getYoutubeVideoId } = require("./urlParse")

let downloadQueueData = {}
let downloadQueue = []

let stopPending = false
let downloadRunning = {}

/* 
    Determines if video download, or general download.
    Pushes a download request to the end of the queue
    Returns downloadRequest.userObject == {
        downloadId: Identification for this download,
        finished: A promise that will resolve on sucessful download, or reject on failed/canceled download,
        errorStream: A stream for error messages,
        infoStream: A stream for all info. Mostly for progress updates.
    }
*/
const addDownload = async (url, options={})=>{
    if(stopPending)
        throw "Downloader is closing. Cannot accept download requests"

    if(!validUrl)
        throw "Not a valid URL"

    options = structuredClone(options) //Ensure we don't write over a users object

    //Verify all values in options are filled. Set to defaults if missing values.
    for (const [key, value] of Object.entries(downloadOptions.getAll())) {
        if(options[key] === undefined)
            options[key] = value
    }

    const isYoutube = urlType(url)==="youtube"?true:false

    let downloadRequest
    if(isYoutube){
        const videoId = getYoutubeVideoId(url)
        downloadRequest = new VideoDownloadRequest(options, videoId)
    }else{
        downloadRequest = new GeneralDownloadRequest(options, url)
    }

    downloadQueue.push(downloadRequest.downloadId)
    downloadQueueData[downloadRequest.downloadId] = downloadRequest

    return downloadRequest.userObject
}

//Marks the download as to-skip. Give user chance to undo in existing position.
const removeDownload = (downloadId)=>{
    if(downloadQueue.contains(downloadId))
        downloadQueueData[downloadId].setSkip()
    else
        throw "Download ID is not in queue"
}

//Disables the skip flag on the download item
const reAddDownload = (downloadId)=>{
    if(downloadQueue.contains(downloadId))
        downloadQueueData[downloadId].setUnskip()
    else
        throw "Download ID is not in queue"
}

//Was the video with the matching options perviously download?
const videoExists = async (videoId, downloadRequest)=>{

    let optionsRaw = await db.query("SELECT video_download_options.options FROM `video_download_options` WHERE video_download_options.download_id != ? AND video_download_options.download_id IN (SELECT download_id FROM video_download WHERE video_id = ? AND completed = 1)", [downloadRequest.downloadId, videoId])
    
    if(optionsRaw.length === 0)
        return false

    //What defines "different"
    // ANY requested options not matching.
    // Tiny changes can justify a redownload.
    for(const {options} of optionsRaw){
        const prevOptions = JSON.parse(options)

        if(!prevOptions)
            break

        let match = true
        for (const [key] of Object.entries(prevOptions)) {
            if(typeof downloadRequest.options[key] == "object"){
                //Arrays included. We do not traverse deeper.

                if(typeof prevOptions[key] !== "object"){
                    match = false
                    break
                }

                for(const subKey in downloadRequest.options[key]){
                    if(downloadRequest.options[key][subKey] !== prevOptions[key][subKey]){
                        match = false
                        break
                    }
                }
            }else if(downloadRequest.options[key] !== prevOptions[key]){
                match = false
                break
            }
        }

        if(match)
            return true
    }
    
    return false
}

// Check if enough space
// Refuses to download when at quota.
// Force will ignore quota and attempt to download anyways.
const downloadNext = async (force=false)=>{

    if(downloadQueue.length == 0)
        return

    let nextDownloadId = downloadQueue.shift()

    try{
        //Was the next download flagged to skip?
        while(downloadQueueData[nextDownloadId].skip){
            downloadQueueData[nextDownloadId].fail("Skipped")

            delete downloadQueueData[nextDownloadId]

            nextDownloadId = downloadQueue.shift()

            if(nextDownloadId === undefined)
                return
        }

        //Has this already been downloaded?
        if(downloadQueueData[nextDownloadId] instanceof VideoDownloadRequest)
            if(await videoExists(downloadQueueData[nextDownloadId].videoId, downloadQueueData[nextDownloadId]))
                throw new Error("This video ID with matching options was previously downloaded")

        //Verify space and quota
        //Cannot estimate file sizes. Simply checks not full.
        if((await storage.remainingStorageOnPath(downloadQueueData[nextDownloadId].options["archive-path-root"])) <= 0)
            throw new Error("Not enough remaining space")

        /*
        TODO: Implement
        if(!force && (await storage.remainingQuota()) <= 0)
            throw new Error("Your download quota has been met")*/

        //Ensure root directories are validated
        storage.validatePath(downloadQueueData[nextDownloadId].options["cache-path"])
        storage.validatePath(downloadQueueData[nextDownloadId].options["temporary-path-root"])
        storage.validatePath(downloadQueueData[nextDownloadId].options["archive-path-root"])

        //List as running
        downloadRunning[nextDownloadId] = true

        //Pass to handlers
        if(downloadQueueData[nextDownloadId] instanceof VideoDownloadRequest)
            await dlProcessor.handleVideoDownload(downloadQueueData[nextDownloadId])
        else
            await dlProcessor.handleGeneralDownload(downloadQueueData[nextDownloadId])

        await downloadQueueData[nextDownloadId].done()
    }catch(error){
        if (typeof error === "object" && error !== null && "stack" in error && "message" in error) {
            downloadQueueData[nextDownloadId].logger.debug(error.stack)

            error = error.message
        }

        await downloadQueueData[nextDownloadId].fail(error)
    }

    delete downloadRunning[nextDownloadId]
    delete downloadQueueData[nextDownloadId]
}

const hasNextDownload = ()=>{
    return downloadQueue.length !== 0
}

//Stops new downloads being accepted, awaits all current downloads to finish
const stop = async ()=>{
    stopPending = true

    downloadQueue = []
    
    for(const downloadId in downloadRunning){
        try{
            await downloadQueueData[downloadId].finished
        }catch(error){}//Errors are passed to user
    }

    downloadQueueData = {}
}

const start = ()=>{
    stopPending = false
}

//Returns an array of downloads in queue (excluding running) download requests
const currentQueue = ()=>{
    const currentQueueResult = structureClone(currentQueue)
    currentQueueResult.map((request)=>{return downloadQueueData[request].userObject})

    return currentQueueResult
}

//Returns an array of downloads running
const currentRunning = ()=>{
    const currentRunningResult = Object.keys(downloadRunning)
    currentRunningResult.map((request)=>{return downloadQueueData[request].userObject})

    return currentRunningResult
}

module.exports = {
    addDownload: addDownload,
    removeDownload: removeDownload,
    reAddDownload: reAddDownload,

    downloadNext: downloadNext,
    hasNextDownload: hasNextDownload,

    currentQueue: currentQueue,
    currentRunning: currentRunning,

    stop: stop,
    start: start
}