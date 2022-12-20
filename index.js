const systemConfig = require("./systemConfig")
const downloadOptions = require("./downloadOptions")
const database = require("./database")
const subscription = require("./subscription")
const polling = require("./polling")
const downloadLoop = require("./downloadLoop")
const downloadManager = require("./downloadManager")

let running = false
let paused = false

const add = async (url, options)=>{
    if(!running)
        throw "Currently not running"

    const addResponse = await downloadManager.addDownload(url, options)

    //Trigger the download loop
    if(systemConfig.get("loop-download")){
        downloadLoop.startDownloads()
    }

    return addResponse
}

const remove = (downloadId)=>{
    downloadManager.removeDownload(downloadId)
}

const undoRemove = (downloadId)=>{
    downloadManager.reAddDownload(downloadId)
}

const start = async ()=>{
    if(running)
        throw "Already running."

    if(paused)
        return resume() // I expect some users may run start instead of resume after pausing
    
    console.log("- Starting database..")
    await database.start()
    console.log("- Database running")

    console.log("- Populating default download options ..")
    await downloadOptions.populate()
    console.log("- Options populated")

    console.log("- Populating subscriptions..")
    await subscription.populate()
    console.log("- Subscriptions populated")

    console.log(" - Starting download manager")
    await downloadManager.start()
    console.log(" - Download manager started")

    if(systemConfig.get("polling-download")){
        if(systemConfig.get("autostart-polling-channel")){
            polling.startChannel()
            console.log("- Channel Polling started")
        }

        if(systemConfig.get("autostart-polling-download")){
            polling.startDownloads()
            console.log("- Download Polling started")
        }
    }

    running = true
}

const stop = async ()=>{
    if(!running)
        throw "Has not been started yet."

    polling.stopChannel()
    polling.stopDownloads()
    downloadLoop.stopDownloads()
    await downloadManager.stop()
    await database.stop()

    running = false
}

const pause = ()=>{
    if(!running)
        throw "Has not been started yet."

    polling.stopChannel()
    polling.stopDownloads()
    downloadLoop.stopDownloads()

    paused = true
    running = false
}

const resume = ()=>{
    if(!paused)
        throw "Was not paused. Cannot resume."

    polling.startChannel()
    polling.startDownloads()
    downloadLoop.startDownloads()

    paused = false
    running = true
}

const defaultOptions = ()=>{
    return downloadOptions.getDefault()
}

const currentQueue = ()=>{
    return downloadManager.currentQueue()
}

const currentRunning = ()=>{
    return downloadManager.currentRunning()
}

module.exports = {
    start: start,
    stop: stop,
    resume: resume,
    pause: pause,

    add: add,
    remove: remove,
    undoRemove: undoRemove,

    defaultOptions: defaultOptions,

    currentQueue: currentQueue,
    currentRunning: currentRunning
}