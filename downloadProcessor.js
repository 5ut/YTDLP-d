//All downloaded files are processed here.
//This file generates data, modifies files, and passes off download requests.
const downloader = require("./downloader")
const ffmpeg = require("ffmpeg")
const fs = require("fs")
const db = require("./database")
const path = require("node:path")
const crypto = require("crypto") //Gives temporary files unqiue Ids
const {validatePath,
    validateFilename,
    windowsPathNameCleanup,
    sizeOfPath,
    pathExistsWithAccess} = require("./filesystem")

// Requests download.
// Moves to final locations
// Itemizes and collects meta data
// Stores in DB
const handleVideoDownload = async (downloadRequest)=>{
    const {logger} = downloadRequest

    let temporaryId

    try{
        // Request download
        const videoDownloadData = await downloader.downloadVideo(downloadRequest)

        logger.info(" ")

        temporaryId = videoDownloadData.temporaryId

        await processVideoDownload(videoDownloadData, downloadRequest)

        logger.info(" ")
 
    }catch(err){
      throw err
    }finally{
        logger.info("Cleaning up..")

        //Clean up download temporary file
        if(temporaryId)
            downloader.cleanUp(temporaryId)
    }
}

const processVideoDownload = async (videoDownloadData, downloadRequest) =>{
    const {logger, options, downloadId, videoId} = downloadRequest

    logger.info("-- Starting Processing --")

    //Clean up all archive directories for windows paths
    if(options["windows-path-compatable"]){
        options["archive-path-root"] =              windowsPathNameCleanup(options["archive-path-root"], options["illegal-replacement-character"])
        options["archive-video-dir"] =              windowsPathNameCleanup(options["archive-video-dir"], options["illegal-replacement-character"])
        options["archive-audio-dir"] =              windowsPathNameCleanup(options["archive-audio-dir"], options["illegal-replacement-character"])
        options["archive-subtitle-auto-dir"] =      windowsPathNameCleanup(options["archive-subtitle-auto-dir"], options["illegal-replacement-character"])
        options["archive-subtitle-manual-dir"] =    windowsPathNameCleanup(options["archive-subtitle-manual-dir"], options["illegal-replacement-character"])
        options["archive-thumbnail-dir"] =          windowsPathNameCleanup(options["archive-thumbnail-dir"], options["illegal-replacement-character"])
        options["video-filename"] =                 windowsPathNameCleanup(options["video-filename"], options["illegal-replacement-character"], true)
    }
    
    let videoArchivePath =            options["archive-path-root"] + "/" + options["archive-video-dir"]
    let audioArchivePath =            options["archive-path-root"] + "/" + options["archive-audio-dir"]
    let subtitleAutoArchivePath =     options["archive-path-root"] + "/" + options["archive-subtitle-auto-dir"]
    let subtitleManualArchivePath =   options["archive-path-root"] + "/" + options["archive-subtitle-manual-dir"]
    let thumbnailArchivePath =        options["archive-path-root"] + "/" + options["archive-thumbnail-dir"]

    let archiveFileList = {
        video: "",
        subtitles: {
            auto: [],
            manual: []
        },
        thumbnail: ""
    }

    //Collect directory sizes before moving
    let archiveFileSize = {
        videoFile: 0,
        subtitlesManual: 0,
        subtitlesAuto: 0,
        thumbnail: 0
    }

    if(pathExistsWithAccess(videoDownloadData.temporaryFiles.videoFileDir))
        archiveFileSize.videoFile = await sizeOfPath(videoDownloadData.temporaryFiles.videoFileDir)

    if(pathExistsWithAccess(videoDownloadData.temporaryFiles.subtitles.manualDir))
        archiveFileSize.subtitlesManual = await sizeOfPath(videoDownloadData.temporaryFiles.subtitles.manualDir)

    if(pathExistsWithAccess(videoDownloadData.temporaryFiles.subtitles.autoDir))
        archiveFileSize.subtitlesAuto = await sizeOfPath(videoDownloadData.temporaryFiles.subtitles.autoDir)

    if(pathExistsWithAccess(videoDownloadData.temporaryFiles.thumbnailDir))
        archiveFileSize.thumbnail = await sizeOfPath(videoDownloadData.temporaryFiles.thumbnailDir)

    // Validate archive root directory
    await validatePath(options["archive-path-root"])
    
    // Move media to archive folder
    if(options["include-video"]){
        await validatePath(videoArchivePath)
    }else if(options["include-audio"]){
        await validatePath(audioArchivePath)
    }

    options["video-filename"] = validateFilename(options["video-filename"], options["illegal-replacement-character"])

    const videoTemporaryFile = videoDownloadData.temporaryFiles.videoFileDir + "/" + videoDownloadData.temporaryFiles.videoFile
    let videoArchiveFile = videoArchivePath + "/" + options["video-filename"]

    let counter = 0
    while(fs.existsSync(videoArchiveFile)){
        counter++
        videoArchiveFile = videoArchivePath + "/" + counter + " - " + options["video-filename"]
    }

    logger.info("Moving video file..")
    await fs.promises.rename(videoTemporaryFile, videoArchiveFile)
    archiveFileList.videoFile = videoArchiveFile

    logger.info("Video file moved to " + videoArchiveFile)

    // Move auto subtitles
    if(options["save-auto-subtitles"] && videoDownloadData.temporaryFiles.subtitles.auto.length > 0){

        logger.info("Moving automatic subtitles..")

        await validatePath(subtitleAutoArchivePath)

        for(const tempSubtitleFile of videoDownloadData.temporaryFiles.subtitles.auto){
            try{
                const uniqueID = crypto.randomUUID()

                const subtitleTemporaryFile = videoDownloadData.temporaryFiles.subtitles.autoDir + "/" + tempSubtitleFile
                const subtitleArchiveFile = subtitleAutoArchivePath + "/" + uniqueID

                await fs.promises.rename(subtitleTemporaryFile, subtitleArchiveFile)

                archiveFileList.subtitles.auto.push({title: tempSubtitleFile, file: subtitleArchiveFile})
            }catch(error){
                logger.error("Failed to move automatic subtitle - "+error)
            }
            
        }

        logger.info("Automatic subtitles moved to "+subtitleAutoArchivePath)
    }

    // Move manual subtitles
    if(options["save-manual-subtitles"] && videoDownloadData.temporaryFiles.subtitles.manual.length > 0){

        logger.info("Moving manual subtitles..")

        await validatePath(subtitleManualArchivePath)

        for(const tempSubtitleFile of videoDownloadData.temporaryFiles.subtitles.manual){
            try{
                const uniqueID = crypto.randomUUID()

                const subtitleTemporaryFile = videoDownloadData.temporaryFiles.subtitles.manualDir + "/" + tempSubtitleFile
                const subtitleArchiveFile = subtitleManualArchivePath + "/" + uniqueID

                await fs.promises.rename(subtitleTemporaryFile, subtitleArchiveFile)

                archiveFileList.subtitles.manual.push({title: tempSubtitleFile, file: subtitleArchiveFile})
            }catch(error){
                logger.error("Failed to move manual subtitle - "+error)
            }
        }

        logger.info("Manual subtitles moved to "+subtitleManualArchivePath)
    }

    // Move thumbnail
    if(options["save-thumbnail"] && videoDownloadData.temporaryFiles.thumbnail !== ""){

        logger.info("Moving thumbnail..")

        await validatePath(thumbnailArchivePath)

        const uniqueID = crypto.randomUUID()

        const thumbnailTemporaryFile = videoDownloadData.temporaryFiles.thumbnailDir + "/" + videoDownloadData.temporaryFiles.thumbnail
        const thumbnailArchiveFile = thumbnailArchivePath + "/" + uniqueID

        await fs.promises.rename(thumbnailTemporaryFile, thumbnailArchiveFile)
        archiveFileList.thumbnail = thumbnailArchiveFile

        logger.info("Thumbnail moved to "+thumbnailArchiveFile)
    }else
        archiveFileList.thumbnail = options["default-thumbnail"]


    // Refactor video meta data so we can standardize values
    logger.info("Building video metadata")

    meta = {}

    meta.id = videoDownloadData.meta.id
    meta.title = videoDownloadData.meta.fulltitle
    meta.description = videoDownloadData.meta.description
    meta.uploader = videoDownloadData.meta.uploader
    meta.uploader_id =  videoDownloadData.meta.uploader_id
    meta.uploader_url = videoDownloadData.meta.uploader_url
    meta.duration = videoDownloadData.meta.duration
    meta.duration_string = videoDownloadData.meta.duration_string
    meta.view_count = videoDownloadData.meta.view_count
    meta.age_limit = videoDownloadData.meta.age_limit
    meta.webpage_url = videoDownloadData.meta.webpage_url
    meta.categories = videoDownloadData.meta.categories
    meta.tags = videoDownloadData.meta.tags
    meta.playable_in_embed = videoDownloadData.meta.playable_in_embed
    meta.is_live = videoDownloadData.meta.is_live
    meta.was_live = videoDownloadData.meta.was_live
    meta.live_status = videoDownloadData.meta.live_status
    meta.chapters = videoDownloadData.meta.chapters
    meta.upload_date = videoDownloadData.meta.upload_date
    meta.channel = videoDownloadData.meta.channel
    meta.availability = videoDownloadData.meta.availability

    meta.thumbnail = archiveFileList.thumbnail

    // Build a video format meta
    logger.info("Building video format metadata")

    let formatMeta = {}

    formatMeta.file = archiveFileList.videoFile

    formatMeta.preprocess = {} // File format meta data about the preprocessed file (as downloaded from Youtube)

    formatMeta.preprocess.asr =             videoDownloadData.meta.asr // Audio sampling rate (Hertz)
    formatMeta.preprocess.filesize_approx = videoDownloadData.meta.filesize_approx
    formatMeta.preprocess.format_note =     videoDownloadData.meta.format_note
    formatMeta.preprocess.fps =             videoDownloadData.meta.fps
    formatMeta.preprocess.height =          videoDownloadData.meta.height
    formatMeta.preprocess.width =           videoDownloadData.meta.width
    formatMeta.preprocess.quality =         videoDownloadData.meta.quality
    formatMeta.preprocess.tbr =             videoDownloadData.meta.tbr // Average bitrate of audio and video in KBit/s
    formatMeta.preprocess.ext =             videoDownloadData.meta.ext
    formatMeta.preprocess.vcodec =          videoDownloadData.meta.vcodec
    formatMeta.preprocess.acodec =          videoDownloadData.meta.acodec
    formatMeta.preprocess.dynamic_range =   videoDownloadData.meta.dynamic_range
    formatMeta.preprocess.vbr =             videoDownloadData.meta.vbr // Average video bitrate in KBit/s
    formatMeta.preprocess.abr =             videoDownloadData.meta.abr // Average audio bitrate in KBit/s
    formatMeta.preprocess.format =          videoDownloadData.meta.format
    formatMeta.preprocess.formatId =        videoDownloadData.meta.format_id
    formatMeta.preprocess.resolution =      videoDownloadData.meta.resolution

    // If the video was converted, the actual file's meta data will differ from the raw youtube video format meta data. We must generate new data off the new file. 
    if(options["allow-video-conversion"] && videoDownloadData.meta["video_ext"] != options["video-format"]){

        logger.info("File was converted. Building additional meta data.")

        const convertedFileMeta = await getVideoFileMeta(archiveFileList.videoFile)

        formatMeta.postprocess = {} // File format meta data about postprocessed file

        formatMeta.postprocess.converted =      true
        formatMeta.postprocess.asr =            convertedFileMeta.audio.sample_rate // Audio sampling rate (Hertz)
        formatMeta.postprocess.filesize =       convertedFileMeta.fs.size
        formatMeta.postprocess.format_note =    videoDownloadData.meta.format_note
        formatMeta.postprocess.fps =            convertedFileMeta.video.fps
        formatMeta.postprocess.height =         convertedFileMeta.video.resolution.h
        formatMeta.postprocess.width =          convertedFileMeta.video.resolution.w
        formatMeta.postprocess.quality =        videoDownloadData.meta.quality // Converting wont change quality
        formatMeta.postprocess.tbr =            +convertedFileMeta.video.bitrate + +convertedFileMeta.audio.bitrate //tbr seems to be the sum of bitrates, not averages. Youtubedl docs are inaccurate. 
        formatMeta.postprocess.ext =            convertedFileMeta.video.container
        formatMeta.postprocess.vcodec =         convertedFileMeta.video.codec
        formatMeta.postprocess.acodec =         convertedFileMeta.audio.codec
        formatMeta.postprocess.dynamic_range =  videoDownloadData.meta.dynamic_range
        formatMeta.postprocess.vbr =            +convertedFileMeta.video.bitrate // Average video bitrate in KBit/s
        formatMeta.postprocess.abr =            +convertedFileMeta.audio.bitrate // Average audio bitrate in KBit/s
        formatMeta.postprocess.format =         videoDownloadData.meta.format + " - Converted"
        formatMeta.postprocess.resolution =     convertedFileMeta.video.resolution.h + "x" + convertedFileMeta.video.resolution.w

    }else
        formatMeta.postprocess = {converted: false}

    //File sizes
    formatMeta.size = {}

    formatMeta.size.video = archiveFileSize.videoFile
    formatMeta.size.subtitlesManual = archiveFileSize.subtitlesManual
    formatMeta.size.subtitlesAuto = archiveFileSize.subtitlesAuto
    formatMeta.size.thumbnail = archiveFileSize.thumbnail

    logger.info("Pushing video format metadata to database")
    await db.query("INSERT INTO video_download_meta(download_id, meta) VALUES (?, ?)", [downloadId, JSON.stringify(formatMeta)])

    // Build meta for subtitles
    logger.info("Building subtitle metadata")

    let subtitleMetas = []

    for(const subtitle of archiveFileList.subtitles.auto){
        let subtitleMeta = findSubtitleMeta(subtitle.title)
        subtitleMeta.isAuto = true
        subtitleMeta.file = subtitle.file

        subtitleMetas.push(subtitleMeta)
    }
    for(const subtitle of archiveFileList.subtitles.manual){
        let subtitleMeta = findSubtitleMeta(subtitle.title)
        subtitleMeta.isAuto = false
        subtitleMeta.file = subtitle.file

        subtitleMetas.push(subtitleMeta)
    }

    logger.info("Pushing subtitle metadata to database")

    for(const subtitleMeta of subtitleMetas){
        await db.query("REPLACE INTO video_subtitles_meta(video_id, meta) VALUES (?, ?)", [videoId, JSON.stringify(subtitleMeta)])
    }

    // Video meta uploading
    logger.info("Pushing video metadata to database")

    await db.query("REPLACE INTO video_meta(video_id, meta) VALUES (?, ?)", [videoId, JSON.stringify(meta)])

    logger.info("-- Processing Complete --")

    // Finds the meta data about the subtitle file, from youtubes response
    function findSubtitleMeta(subtitle){
        if(process.platform === "win32")
            subtitle = path.win32.basename(subtitle)
        else
            subtitle = path.posix.basename(subtitle)

        const langCode = subtitle.split(".").at(-2)

        for(const langMeta of videoDownloadData.meta.subtitles[langCode]){
            if(langMeta.ext === options["subtitles-format"])
            return {
                ext: langMeta.ext,
                name: langMeta.name
            }
        }
    }
}

// Given video file, returns meta data
const getVideoFileMeta = (videoFile)=>{
    return new Promise((resolve, reject)=>{
        new ffmpeg(videoFile).then(async video => {
            //We also need FS meta data
            const fileStats =  await fs.promises.stat(videoFile)
            
            video.metadata.fs = {
                size: fileStats.size,
                createTime: fileStats.cTime
            }

            resolve(video.metadata)
        }, function (err) {
            throw new Error(err)
        });
    })
}

const handleGeneralDownload = async (download)=>{
    downloadFilesTemp = await downloader.downloadGeneral(downloadQueueData[nextDownload].url, downloadQueueData[nextDownload].options)
}

module.exports = {
    handleVideoDownload: handleVideoDownload,
    handleGeneralDownload: handleGeneralDownload
}