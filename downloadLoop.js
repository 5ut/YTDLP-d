//Loop handler for the downloads
const config = require("./systemConfig")
const downloadManager = require("./downloadManager")

let downloadsRunning = false
let downloadCount = 0
let requestStop = false

const download = async ()=>{
    downloadCount++
    await downloadManager.downloadNext()
    downloadCount--
}

const startDownloads = async ()=>{
    if(downloadsRunning)
        return

    downloadsRunning = true

    while(downloadManager.hasNextDownload() && !requestStop){
        if(!config.get("loop-download-serial")){
            if(downloadCount < config.get("parallel-download-max"))
                download()
            else
                await download()
        }else
            await download()
    }
        
    requestStop = false
    downloadsRunning = false
}

const stopDownloads = ()=>{
    if(!downloadsRunning)
        return

    requestStop = true
}

module.exports = {
    startDownloads: startDownloads,
    stopDownloads: stopDownloads
}