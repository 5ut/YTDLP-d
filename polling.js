//Polling handlers and internal logic
const config = require("./systemConfig")
const downloadManager = require("./downloadManager")

let pollingHandlerChannel
let pollingHandlerDownload

let downloadHandlerLockout = false
let downloadCount = 0

//The main polling call to handle the caching of all channel data. 
//Includes: Channel meta data (related channels, sub count, views, etc)
//          Comments on each video
//          Video list
const startChannelInternal = async ()=>{
    
}

//The main polling call to handle the downloads of videos
const startDownloadInternal = ()=>{
    if(config.get("polling-download-serial"))
        startDownloadSerial()
    else
        startDownloadParallel()
}

// We lock out any other calls to start a download. Waiting until previous download is done. 
const startDownloadSerial = async ()=>{
    if(downloadHandlerLockout){
        return
    }

    downloadHandlerLockout = true
    await downloadManager.downloadNext()
    downloadHandlerLockout = false
}

const startDownloadParallel = async ()=>{
    if(downloadCount == config.get("parallel-download-max"))
        return

    downloadCount++
    downloadHandlerLockout = true // We still set the lockout, incase the settings were changed to serial mid-download of a parallel. 
    

    await downloadManager.downloadNext()

    downloadCount--
    downloadHandlerLockout = false
}

//The two polling functions are kept seperate to allow channel caching to continue
//as videos are being downloaded.
//As well, it allows the users to start & stop video/channel downloads independently

const startChannel = ()=>{
    stopChannel()

    startChannelInternal()
    pollingHandlerChannel = setInterval(startChannelInternal, config.get("polling-time-channel") * 1000 * 60 )
}

const startDownloads = ()=>{
    stopDownloads()

    startDownloadInternal()
    pollingHandlerDownload = setInterval(startDownloadInternal, config.get("polling-time-download") * 1000 * 60 )
}

const stopChannel = ()=>{
    clearInterval(pollingHandlerChannel)
}

const stopDownloads = ()=>{
    clearInterval(pollingHandlerDownload)
}

module.exports = {
    startChannel: startChannel,
    startDownloads: startDownloads,
    stopChannel: stopChannel,
    stopDownloads: stopDownloads
}