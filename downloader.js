//Handles downloading tasks.
// Only downloads file and reports back files-locations/data
const fs = require("fs")
const ytdl = require("youtube-dl-exec")
const axios = require("axios")
const readline = require('node:readline/promises')
const crypto = require("crypto")//Gives temporary files unqiue Ids
const {validatePath, windowsPathNameCleanup} = require("./filesystem")

const temporaryWorkDirectory = {}

//Returns list of files / video meta / format meta / subtitle meta / temporary ID 
const downloadVideo = async (downloadRequest)=>{
    const {videoId, options, logger} = downloadRequest

    logger.info("-- Starting Download of "+downloadRequest.videoId+" --")

    //Clean up all directories for windows paths
    if(options["windows-path-compatable"]){
        options["temporary-path-root"] =            windowsPathNameCleanup(options["temporary-path-root"], options["windows-path-replacement-character"])
        options["temporary-video-dir"] =            windowsPathNameCleanup(options["temporary-video-dir"], options["windows-path-replacement-character"])
        options["temporary-audio-dir"] =            windowsPathNameCleanup(options["temporary-audio-dir"], options["windows-path-replacement-character"])
        options["temporary-subtitle-auto-dir"] =    windowsPathNameCleanup(options["temporary-subtitle-auto-dir"], options["windows-path-replacement-character"])
        options["temporary-subtitle-manual-dir"] =  windowsPathNameCleanup(options["temporary-subtitle-manual-dir"], options["windows-path-replacement-character"])
        options["temporary-thumbnail-dir"] =        windowsPathNameCleanup(options["temporary-thumbnail-dir"], options["windows-path-replacement-character"])
        options["temporary-temp-dir"] =             windowsPathNameCleanup(options["temporary-temp-dir"], options["windows-path-replacement-character"], true)
    }

    //Rewrite the simpler tokens for yt-dlp tokens
    options["archive-video-dir"] =              pathnamePreprocessor(options["archive-video-dir"])
    options["archive-audio-dir"] =              pathnamePreprocessor(options["archive-audio-dir"])
    options["archive-subtitle-auto-dir"] =      pathnamePreprocessor(options["archive-subtitle-auto-dir"])
    options["archive-subtitle-manual-dir"] =    pathnamePreprocessor(options["archive-subtitle-manual-dir"])
    options["archive-thumbnail-dir"] =          pathnamePreprocessor(options["archive-thumbnail-dir"])
    options["video-filename"] =                 pathnamePreprocessor(options["video-filename"])

    //Name a new work directory
    let temporaryId = crypto.randomUUID()
    while(fs.existsSync(options["temporary-path-root"] + "/" + temporaryId))
        temporaryId = crypto.randomUUID()
    options["temporary-path-root"] += "/" + temporaryId
    temporaryWorkDirectory[temporaryId] = options["temporary-path-root"]

    if(options["video-filename-append-ext"])
        options["video-filename"] += ".%(ext)s"

    //Yt-dlp does not have the option to return a list of all downloaded files. Subtitle/thumbnail files downloaded are a mystery.
    //However you can split where each file is saved to, so we will load each file type into unique folders and get lists of files by scanning the folders.
    let temporaryFilePathList = {
        videoFileDir: "",
        videoFile: "",
        subtitles: {
            autoDir: "",
            auto: [],
            manualDir: "",
            manual: []
        },
        thumbnailDir: "",
        thumbnail: ""
    }

    //Validate all directories
    logger.info("Building temporary directories")
    await validateDirectories(options)

    // There's no way to split auto generated subtitles, and manual subtitles. We will download auto subs first before the manual subs, storing in seperate folders.
    if(options["save-manual-subtitles"] && options["save-auto-subtitles"]){
        let tempOptions = structuredClone(options)

        tempOptions["includeAudio"] = tempOptions["includeVideo"] = tempOptions["save-thumbnail"] = tempOptions["save-manual-subtitles"] = false // We override any download besides auto subtitles

        const execOptions = generateYoutubeDLOptions(tempOptions)

        logger.info("Attempting to download auto-generated subtitles...")

        const ytdlpProcess = runYTDLP("https://www.youtube.com/watch?v="+videoId, execOptions)

        ytdlpProcess.stderr.on("line", (outputLine)=>{
            logger.error(outputLine)
        })

        await ytdlpProcess.finished

        logger.info("Auto-generated subtitles download successful")

        options["save-auto-subtitles"] = false // Already downloaded
    }

    //Generate execution parameters for YTDLP based off user options
    const execOptions = generateYoutubeDLOptions(options)

    //We use the YTDLP processor to generate the values of our folder names, for consistancy (instead of pulling from metadata).
    execOptions["quiet"] = true
    execOptions["dump-json"] = true
    execOptions["no-simulate"] = true
    execOptions["print"] = [
        "after_move:PATH_ROOT:" +           options["archive-path-root"],
        "after_move:VIDEO_DIR:" +           options["archive-video-dir"],
        "after_move:AUDIO_DIR:" +           options["archive-audio-dir"],
        "after_move:SUBTITLE_AUTO_DIR:" +   options["archive-subtitle-auto-dir"],
        "after_move:SUBTITLE_MANUAL_DIR:" + options["archive-subtitle-manual-dir"],
        "after_move:THUMBNAIL:" +           options["archive-thumbnail-dir"],
        "after_move:VIDEO_FILE:" +          options["video-filename"],
    ]
    execOptions["progress"] = true
    execOptions["newline"] = true
    execOptions["progress-template"] = "PROGRESS:%(progress)j"

    logger.info("Starting video download...")

    let meta

    const ytdlpProcess = runYTDLP("https://www.youtube.com/watch?v="+videoId, execOptions)

    ytdlpProcess.stderr.on("line", (outputLine)=>{
        logger.error(outputLine)
    })

    // Parse out each line to collect data.
    ytdlpProcess.stdout.on("line", (outputLine)=>{
        logger.debug("YTDLP:" + outputLine)

        const outputParsed = outputLine.split(':')

        //JSON is the only line without a description code. (Limitation of ytdlp)
        if(outputParsed[0][0] == '{'){
            meta = JSON.parse(outputLine)
            return
        }

        switch(outputParsed[0]){
            case "PATH_ROOT":
                options["archive-path-root"] = outputLine.replace("PATH_ROOT:", "")
            break
            case "VIDEO_DIR":
                options["archive-video-dir"] = outputLine.replace("VIDEO_DIR:", "")
            break
            case "AUDIO_DIR":
                options["archive-audio-dir"] = outputLine.replace("AUDIO_DIR:", "")
            break
            case "SUBTITLE_AUTO_DIR":
                options["archive-subtitle-auto-dir"] = outputLine.replace("SUBTITLE_AUTO_DIR:", "")
            break
            case "SUBTITLE_MANUAL_DIR":
                options["archive-subtitle-manual-dir"] = outputLine.replace("SUBTITLE_MANUAL_DIR:", "")
            break
            case "THUMBNAIL":
                options["archive-thumbnail-dir"] = outputLine.replace("THUMBNAIL:", "")
            break
            case "VIDEO_FILE":
                options["video-filename"] = outputLine.replace("VIDEO_FILE:", "")
            break
            case "PROGRESS":
                let progressData = outputLine.replace("PROGRESS:", "")
                try{
                    const progressJSON = JSON.parse(progressData)

                    logger.info(progressJSON._default_template)
                }catch(error){
                    logger.error("Failed to parse progress data")
                }
            break
            default:
                logger.error("Unexpected output on YT-DLP: "+outputLine)
            break;
        }
    })

    await ytdlpProcess.finished

    logger.info("Video download successful")

    // Scan the temporary folders to find all the files
    temporaryFilePathList.videoFileDir = options["temporary-path-root"] + "/" + options["temporary-video-dir"]
    temporaryFilePathList.videoFile = ((await fs.promises.readdir(temporaryFilePathList.videoFileDir))[0])

    temporaryFilePathList.subtitles.autoDir = options["temporary-path-root"] + "/" + options["temporary-subtitle-auto-dir"]
    if(options["save-auto-subtitles"])
            if(fs.existsSync(temporaryFilePathList.subtitles.autoDir))
                temporaryFilePathList.subtitles.auto = (await fs.promises.readdir(temporaryFilePathList.subtitles.autoDir))
    
    temporaryFilePathList.subtitles.manualDir = options["temporary-path-root"] + "/" + options["temporary-subtitle-manual-dir"]
    if(options["save-manual-subtitles"])
            if(fs.existsSync(temporaryFilePathList.subtitles.manualDir))
                temporaryFilePathList.subtitles.manual = (await fs.promises.readdir(temporaryFilePathList.subtitles.manualDir))

    temporaryFilePathList.thumbnailDir = options["temporary-path-root"] + "/" + options["temporary-thumbnail-dir"]
    if(options["save-thumbnail"])
            if(fs.existsSync(temporaryFilePathList.thumbnailDir))
                temporaryFilePathList.thumbnail = (await fs.promises.readdir(temporaryFilePathList.thumbnailDir))[0]

    logger.info("Video file found: \""+temporaryFilePathList.videoFile + "\"")
    logger.info("Number of auto-generated subtitles found: "+temporaryFilePathList.subtitles.auto.length)
    logger.info("Number of manually-generated subtitles found: "+temporaryFilePathList.subtitles.manual.length)
    logger.info("Thumnbail found: \""+temporaryFilePathList.thumbnail+"\"")

    logger.info("-- Download Complete --")

    let sharedId

    return {meta: meta, temporaryFiles:temporaryFilePathList, temporaryId: temporaryId}

    function pathnamePreprocessor(rawPath){
        rawPath = rawPath.replaceAll("$title", "%(title)s")
        rawPath = rawPath.replaceAll("$videoId", "%(id)s")
        rawPath = rawPath.replaceAll("$videoext", "%(ext)s")
        rawPath = rawPath.replaceAll("$thumnailext", options["thumbnail-format"])
        rawPath = rawPath.replaceAll("$subtitleext", options["subtitles-format"])
        rawPath = rawPath.replaceAll("$audioext", options["audio-format"])
        rawPath = rawPath.replaceAll("$uploader", "%(uploader)s")
        rawPath = rawPath.replaceAll("$uploaderId", "%(channel_id)s")

        if(rawPath.includes("$uniqueId")){
            const uniqueId = crypto.randomUUID()

            rawPath = rawPath.replaceAll("$uniqueId", uniqueId)
        }

        if(rawPath.includes("$sharedId")){
            if(!sharedId)
                sharedId = crypto.randomUUID()

            rawPath = rawPath.replaceAll("$sharedId", sharedId)
        }

        return rawPath
    }
}

// Starts the YTDLP process
// returns stdout/stderr streams, and a promise that completes on success or fails on error
const runYTDLP = (url, options)=>{
    let finish
    let fail

    let returnValues = {finished: new Promise((resolve, reject)=>{finish=resolve, fail=reject}), stdout: false, stderr: false}

    const ytdlpProcess = ytdl.exec(url, options, {reject: false})

    const ytdlpStdoutStream = readline.createInterface({ input: ytdlpProcess.stdout })
    const ytdlpStderrStream = readline.createInterface({ input: ytdlpProcess.stderr })

    returnValues.stdout = ytdlpStdoutStream
    returnValues.stderr = ytdlpStderrStream

    ytdlpProcess.on("close", (code)=>{
        if(code != 0)
            fail("YTDLP closed with error: "+code)
        else
            finish()
    })

    return returnValues
}

// Returns video meta data (descriptions, views, etc) based off the request, without saving files.
// Attempts to grab from cache first. 
const downloadVideoMeta = async (videoId, options)=>{
    //Generate execution parameters for YTDLP based off user options
    const execOptions = generateYoutubeDLOptions(options)

    //Causes simulation. Nothing will be written. 
    execOptions["dump-json"] = true

    return await ytdl("https://www.youtube.com/watch?v="+videoId, execOptions)
}

//Generates the options parameter for YT-DLP based off manually overridden, and default values.
const generateYoutubeDLOptions = (options)=>{

    //Generate options for YTDL
    let execOptions = {}

    //Cache directory
    execOptions["cache-dir"] = options["cache-path"]

    // Video/Audio output
    if(options["include-video"])
        execOptions["paths"] = [options["temporary-path-root"] + "/" + options["temporary-video-dir"]]
    else
        execOptions["paths"] = [options["temporary-path-root"] + "/" + options["temporary-audio-dir"]]

    execOptions["paths"].push("temp:"+ options["temporary-path-root"] + "/" + options["temporary-temp-dir"])

 
    const streamableConfig = {
        "video-format":             "mp4",
        "audio-format":             "m4a",
        "video-quality":            "best",
        "audio-quality":            "best"
    }

    // "force-browser-streamable" will override video configuration to support browser streaming
    if(options["force-browser-streamable"] && options["include-video"]){
        options["video-format"] =   streamableConfig["video-format"]
        options["audio-format"] =   streamableConfig["audio-format"]
        options["video-quality"] =  streamableConfig["video-quality"]
        options["audio-quality"] =  streamableConfig["audio-quality"]
    }

    //Subtitles
    execOptions["write-subs"] = options["save-manual-subtitles"]
    execOptions["write-auto-subs"] = options["save-auto-subtitles"]
    execOptions["sub-format"] = options["subtitles-format"]
    let langListStr = ""
    for(const lang of options["subtitles-languages"]){
        // If any item is "all", we dont need to any other languages.
        if(lang === "all"){
            langListStr = "all"
            break
        }

        langListStr += ","+lang
    }
    langListStr = langListStr.replace(",", "") 
    execOptions["sub-langs"] = langListStr

    if(options["save-manual-subtitles"]){
        execOptions["paths"].push("subtitle:"+options["temporary-path-root"] + "/" + options["temporary-subtitle-manual-dir"])
    }else if(options["save-auto-subtitles"]){
        execOptions["paths"].push("subtitle:"+options["temporary-path-root"] + "/" + options["temporary-subtitle-auto-dir"])
    }

    //Thumbnail
    execOptions["write-thumbnail"] = options["save-thumbnail"]
    execOptions["convert-thumbnails"] = options["thumbnail-format"]
    execOptions["paths"].push("thumbnail:"+options["temporary-path-root"] + "/" + options["temporary-thumbnail-dir"])

    //Skip download?
    if(!options["include-video"] && !options["include-audio"])
        execOptions["skip-download"] = true

    //Flag for conversion?
    if(options["allow-video-conversion"])
        if(options["include-video"])
            execOptions["recode-video"] = options["video-format"]
        else if(options["include-audio"])
            execOptions["extract-audio"] = options["audio-format"]

    //We cannot force an audio quality, but not allow the formats to be merged. 
    if(!options["ignore-audio-quality-on-video"] && !options["allow-video-audio-merging"])
        options["ignore-audio-quality-on-video"] = true

    //Requested format
    execOptions["format"] = ""
    if(options["include-video"] || options["include-audio"]){
        execOptions["format"] = generateFormatString(
            options["include-video"],
            options["include-audio"],
            options["video-quality"],
            options["audio-quality"],
            options["video-format"],
            options["audio-format"],
            options["ignore-audio-quality-on-video"],
            options["allow-video-audio-merging"],
            options["ignore-downloaded-format"],
            options["max-file-size"]
        )
    }

    //String builder for the format string to pass to YT-DLP in -f
    function generateFormatString(
        includeVideo,
        includeAudio,
        videoQuality,
        audioQuality,
        videoFormat,
        audioFormat,
        ignoreAudioQualityOnVideo,
        allowVideoAudioMerge,
        ignoreFormat,
        maxFileSize
    ){
        //  Additional limits, such as maximum file size is always added.
        //  Eg: IncludeVideo, IncludeAudio, BestVideo, WorstAudio, video-format=mp4, audio-format=mp3, ignore-audio-quality-on-video, allow-video-audio-merging, ignore-downloaded-format, max-file-size=0
        //      best*[vcodec!=none][acodec!=none]/bestvideo+bestaudio
        //  Eg: IncludeVideo, IncludeAudio, BestVideo, WorstAudio, video-format=mp4, audio-format=mp3, ignore-audio-quality-on-video, allow-video-audio-merging, !ignore-downloaded-format, max-file-size=0
        //      best*[vcodec!=none][acodec!=none][ext=mp4]/bestvideo[ext=mp4]+bestaudio
        //  Eg: IncludeVideo, IncludeAudio, BestVideo, WorstAudio, video-format=mp4, audio-format=mp3, ignore-audio-quality-on-video, !allow-video-audio-merging, !ignore-downloaded-format, max-file-size=0
        //      best*[vcodec!=none][acodec!=none][ext=mp4]
        //  Eg: IncludeVideo, IncludeAudio, BestVideo, WorstAudio, video-format=mp4, audio-format=mp3, ignore-audio-quality-on-video, !allow-video-audio-merging, ignore-downloaded-format, max-file-size=0
        //      best*[vcodec!=none][acodec!=none]
        //  Eg: IncludeVideo, IncludeAudio, BestVideo, WorstAudio, video-format=mp4, audio-format=mp3, !ignore-audio-quality-on-video, allow-video-audio-merging, ignore-downloaded-format, max-file-size=0
        //      bestvideo+worstaudio
        //  Eg: IncludeVideo, IncludeAudio, BestVideo, WorstAudio, video-format=mp4, audio-format=mp3, !ignore-audio-quality-on-video, allow-video-audio-merging, !ignore-downloaded-format, max-file-size=0
        //      bestvideo[ext=mp4]+worstaudio
        //  Eg: IncludeVideo, IncludeAudio, BestVideo, WorstAudio, video-format=mp4, audio-format=mp3, !ignore-audio-quality-on-video, !allow-video-audio-merging, ignore-downloaded-format, max-file-size=0
        //      best*[vcodec!=none][acodec!=none]
        //  Eg: IncludeVideo, IncludeAudio, BestVideo, WorstAudio, video-format=mp4, audio-format=mp3, !ignore-audio-quality-on-video, !allow-video-audio-merging, !ignore-downloaded-format, max-file-size=0
        //      best*[vcodec!=none][acodec!=none][ext=mp4]
        //  Eg: IncludeVideo, IncludeAudio, BestVideo, WorstAudio, video-format=mp4, audio-format=mp3, ignore-audio-quality-on-video, allow-video-audio-merging, ignore-downloaded-format, max-file-size=200
        //      best*[vcodec!=none][acodec!=none][filesize<=200M]/bestvideo[filesize<=200M]+bestaudio
        //  Eg: IncludeVideo, !IncludeAudio, BestVideo, WorstAudio, video-format=mp4, audio-format=mp3, ignore-audio-quality-on-video, allow-video-audio-merging, ignore-downloaded-format, max-file-size=200
        //      best*[vcodec!=none][acodec=none][filesize<=200M]
        //  Eg: !IncludeVideo, IncludeAudio, BestVideo, WorstAudio, video-format=mp4, audio-format=mp3, ignore-audio-quality-on-video, allow-video-audio-merging, ignore-downloaded-format, max-file-size=200
        //      worst*[vcodec=none][acodec=none][filesize<=200M]

        return ((ignoreAudioQualityOnVideo && includeVideo) || !includeVideo?

            (includeVideo? videoQuality:audioQuality) + "*" + // best
            (!includeVideo? "[vcodec=none]":"[vcodec!=none]") + (!includeAudio?"[acodec=none]":"[acodec!=none]") + // [vcodec!=none][acodec=none]
            (!ignoreFormat? "[ext=" + (includeVideo?videoFormat:audioFormat) +"]":"") + // [ext=mp4]
            (maxFileSize>0? "[filesize<="+maxFileSize+"]M":"") + // [filesize<=200M]
            (allowVideoAudioMerge && includeVideo && includeAudio? "/" : "")

        :

            ""

        )

        +

        (allowVideoAudioMerge && includeVideo && includeAudio?

            videoQuality+"video" + // bestvideo
            (!ignoreFormat? "[ext=" + videoFormat +"]":"") + // [ext=mp4]
            (maxFileSize>0? "[filesize<="+maxFileSize+"M]":"") + // [filesize<=200M]
            "+" +
            (ignoreAudioQualityOnVideo?videoQuality:audioQuality)+"audio" //bestaudio

        :

            ""

        )
    }

    execOptions["o"] = crypto.randomUUID()

    return execOptions
}

//Downloads the given link, as-is. Useful for profile pics, css, etc
//Returns file, and meta file (json)
const downloadGeneral = (url, options)=>{
    return new Promise(async (resolve, reject)=>{
        try{
            await validate()

            const fileId = crypto.randomUUID()
            const filePath = options["temporary-path-root"] + "/" + fileId + "/"

            const writeStream = fs.createWriteStream(filePath + fileId)

            writeStream.on("error", (err) => {
                return reject(err)
            })

            writeStream.on("finish", ()=>{
                return resolve(filePath + fileId)
            })

            writeStream.on("ready", async () => {
                try{
                    const response = await axios({
                        method: 'GET',
                        url: url,
                        responseType: 'stream',
                    })

                    response.data.pipe(writeStream)
                }catch(weberr){
                    writeStream.destroy(weberr)
                }
            })
        }catch(err){
            return reject(err)
        }
    })
}

//Neither size estimation below is guarenteed. Used as a guideline. 
//Best used to push notifications to user.

const downloadVideoSize = async (videoId)=>{
    try{
        const videoSize = await ytdl("https://www.youtube.com/watch?v="+videoId, {
            "skip-download": true,
            "print": "filesize_approx"
        })

        return videoSize
    }catch(err){
        throw new Error(err)
    }
}

//Returns 0 on no header response.
const downloadGeneralSize = async (url)=>{
    try{
        const response = await axios({
            method: 'HEAD',
            url: url,
            headers: {"Accept-Encoding": "identity"}//Disable encoding
        })

        if(response.headers["Content-Length"])
            return response.headers["Content-Length"]
        else
            return 0
    }catch(err){
        throw new Error(err)
    }
}

// Ensures all temporary folders exist and are writeable
const validateDirectories = async (options)=>{
    //Root
    await validatePath(options["temporary-path-root"])

    //Video
    if(options["include-video"])
        await validatePath(options["temporary-path-root"] + "/" + options["temporary-video-dir"])

    //Audio
    if(options["include-audio"] && !options["include-video"])
        await validatePath(options["temporary-path-root"] + "/" + options["temporary-audio-dir"])

    //Subtitles auto
    if(options["save-auto-subtitles"])
        await validatePath(options["temporary-path-root"] + "/" + options["temporary-subtitle-auto-dir"])

    //Subtitles manual
    if(options["save-manual-subtitles"])
        await validatePath(options["temporary-path-root"] + "/" + options["temporary-subtitle-manual-dir"])

    //Thumbnail
    if(options["save-thumbnail"])
        await validatePath(options["temporary-path-root"] + "/" + options["temporary-thumbnail-dir"])

    //Temporary
    await validatePath(options["temporary-path-root"] + "/" + options["temporary-temp-dir"])
}

const cleanUp = (temporaryId)=>{
    if(temporaryWorkDirectory[temporaryId]){
        if(!fs.existsSync(temporaryWorkDirectory[temporaryId])){
            return true
        }

        if(fs.rmSync(temporaryWorkDirectory[temporaryId], { recursive: true, force: true })){
            delete temporaryWorkDirectory[temporaryId]
            return true
        }

        return false
    }
    return true
}

module.exports = {
    downloadVideo: downloadVideo,
    downloadVideoMeta: downloadVideoMeta,
    downloadGeneral: downloadGeneral,
    downloadVideoSize: downloadVideoSize,
    downloadGeneralSize: downloadGeneralSize,
    cleanUp: cleanUp
}