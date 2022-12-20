//Default download parameters
const db = require("./database")

let downloadOptions = {} // These can be changed on a download to download basis. Each download submits these options, or uses defaults.

/*
//Channel polling
downloadOptions["polling-time-channel"] = 1 // Heartbeat (in minutes) of channel polling function. High intervals can miss videos, but low values can get your IP blocked.
downloadOptions["autostart-polling-channel"] = true  // Start polling for video downloads on boots

//Polling downloads
downloadOptions["polling-download"] = false // When looking for the next video to download, should the polling method be used? This will look for a new video on a fix interval. This, or "loop-download" must be true. Both cannot be true.
downloadOptions["polling-time-download"] = 0.005 // Heartbeat (in minutes) of polling video download function
downloadOptions["autostart-polling-download"] = true // Start polling for channels on boot
downloadOptions["polling-download-serial"] = false // Will the polling system operate in a serial mode? The next polling function will not be called until the previous has returned. It will wait one whole "polling-time-video". Otherwise, it'll run parallel and download even if another is downloading.

//Loop downloads
downloadOptions["loop-download"] = true // This will cause the system to run a loop of downloading videos until it runs out. This auto-restarts when another is added. This, or "polling-download" must be true. Both cannot be true.
downloadOptions["loop-download-serial"] = false // If the system is currently downloading a video, do you want it to wait for that download to complete and automatically call the new download to start?

//Parallel downloads
downloadOptions["parallel-download-max"] = 5 // The amount of concurrent downloads allowed to occur.

//Maximum allowed storage
downloadOptions["max-storage-size"] = 500 // Gigabytes
downloadOptions["max-storage-size"] *= 1024 * 1024 * 1024 // MB * KB * B*/

//Path for yt-dlp internal cache
downloadOptions["cache-path"] = "/storage/Coding/web_root/youtube/OfflineTube/Cache" // Requires absolute.

//Location where the partial and pre-moved file storage is
//          *EACH DIR MUST BE UNQIUE*
// Cannot traverse back. I.e, ".." is not allowed.
downloadOptions["temporary-path-root"] = "/storage/Coding/web_root/youtube/OfflineTube/Temporary" // Requires absolute. Unique value will be appended to avoid collision during download.
downloadOptions["temporary-video-dir"] = "video" // Subfolder of "temp-location-root" that stores video 
downloadOptions["temporary-audio-dir"] = "audio" // Subfolder of "temp-location-root" that stores audio
downloadOptions["temporary-subtitle-auto-dir"] = "subtitle-auto" // Subfolder of "temp-location-root" that stores auto subtitles.
downloadOptions["temporary-subtitle-manual-dir"] = "subtitle-manual" // Subfolder of "temp-location-root" that stores manual subtitles. 
downloadOptions["temporary-thumbnail-dir"] = "thumbnail" // Subfolder of "temp-location-root" that stores thumbnails
downloadOptions["temporary-temp-dir"] = "temp" // Subfolder of "temp-location-root" that stores partial files.

//Location where downloads will be stored.
//Search and replace can be used for values from video; Eg: /folder/path/$videoId/thumbnail/
//  $title = Full title of video (Striped to folder-safe only characters)
//  $videoId = Video ID; Eg: https://www.youtube.com/watch?v=Y7dpJ0oseIA becomes, Y7dpJ0oseIA
//  $videoext/$thumnailext/$subtitleext/$audioext = The extension of the specified medium; Eg: mp4
//  $uploader = Uploader name (Striped to folder-safe only characters)
//  $uploaderId = Uploader ID
//  $uniqueId = Uniquely generated ID. Each config option will have a new ID. 
//  $sharedId = Shared ID. This will be replaced by the same ID on each config. 
//Each dir does *NOT* need to be unique. 
//Can traverse back if needed
downloadOptions["archive-path-root"] =  "/storage/Coding/web_root/youtube/OfflineTube/Archive" // Base path of the archive folders. Does not support search and replace.
downloadOptions["archive-video-dir"] = "$uploader/video"
downloadOptions["archive-audio-dir"] = "$uploader/audio"
downloadOptions["archive-subtitle-auto-dir"] = "$uploader/subtitles"
downloadOptions["archive-subtitle-manual-dir"] = "$uploader/subtitles"
downloadOptions["archive-thumbnail-dir"] = "$uploader/thumbnail"
downloadOptions["video-filename"] = "$title" // All collision will have an incremented number prepended.
downloadOptions["video-filename-append-ext"] = true // Should ".$videoext" be appended to the end of the filename?

//Windows
downloadOptions["windows-path-compatable"] = true // Do the file names and folder need to be windows compatable? This will replace many different types of characters. All reserved names are prefixed with '_'

//Post processing
downloadOptions["illegal-replacement-character"] = '_' // If illegal characters are found, what should be used in place? "'" is a valid option as well. Must be a single character.

//Subtitles
downloadOptions["save-manual-subtitles"] = true // Save human created subtitles?
downloadOptions["save-auto-subtitles"] = false // Save computer generated subtitles?
downloadOptions["subtitles-languages"] = ["en", "fr"] // ["all"] will obtain all, but will likely cause 429 http error. If all are needed it's best used with a rate limiter.
downloadOptions["subtitles-format"] = "vtt" // vtt, ttml, srv3, srv2, srv1, json3

//Thumbnail
downloadOptions["save-thumbnail"] = true // Falls back to default if disabled
downloadOptions["thumbnail-format"] = "jpg" // jpg, png, webp
downloadOptions["default-thumbnail"] = "./default_thumb.jpg" // Absolute path to default thumbnail

//Video & Audio parameters
downloadOptions["include-video"] = true //If disabled, converts to audio file.
downloadOptions["include-audio"] = true

downloadOptions["video-format"] = "mp4"  
downloadOptions["audio-format"] = "mp3" // Ignored if including video
downloadOptions["video-quality"] = "best" // best / worst. Specific qualities can be chosen, but on a video to video basis. Best to download the list of qualities and download specific ones.
downloadOptions["audio-quality"] = "best" // best / worst. 

downloadOptions["ignore-audio-quality-on-video"] = true // When downloading a video, do you want to ignore the audio quality? This can useful if you are attempting to stop any post-processing. if false, "allow-video-audio-merging" is required, otherwise this option is overridden.
downloadOptions["allow-video-audio-merging"] = false // If a video of your specified format could not be found with an audio channel, would you like to download an audio channel and mux each other. Requires a small amount of processing.=
downloadOptions["ignore-downloaded-format"] = false // Any format will be attempted to be downloaded. Useful if your only goal is quality.
downloadOptions["allow-video-conversion"] = false // If the requested video format was not downloaded, should a conversion be done in post-processing? Can be very time consuming on large videos. (if ignore-downloaded-format is false, this option wont be used.)
downloadOptions["force-browser-streamable"] = false // Ignored if "include-video" is false. **Overrides all formatting options** Ensures all videos are downloaded as a streamable format. Quality still honored. 

downloadOptions["max-file-size"] = 0 // In MB, sets the maximum limit for video download. 0 for unlimited. Since this can be a unmonitored service, it's possible it can download a LARGE file so it's best to set an upper limit.

//We manually validate the input of each key. Since this can be user supplied input, we must validate it
//We won't "fix" values. If the supplied value wasn't valid, we don't modify it to be correct.
const validValue = (key, value)=>{

    validKey(key)

    if(downloadOptions[key] === value)
        throw "This key is already set to this value"

    switch(key){
        case "polling-time-channel":
            if(!isPositiveNumber(value))
                throw "Must be a positive value > 0"
            return true

        case "autostart-polling-channel":
            if(typeof value !== "boolean")
                throw "Must be a boolean"
            return true

        case "polling-download":
            if(typeof value !== "boolean")
                throw "Must be a boolean"
            if(value === downloadOptions["loop-download"])
                throw "\"loop-download\" cannot be the same value"
            return true

        case "polling-time-download":
            if(!isPositiveNumber(value))
                throw "Must be a positive value > 0"
            return true

        case "autostart-polling-download":
            if(typeof value !== "boolean")
                throw "Must be a boolean"
            return true
            
        case "polling-download-serial":
            if(typeof value !== "boolean")
                throw "Must be a boolean"
            return true

        case "loop-download":
            if(typeof value !== "boolean")
                throw "Must be a boolean"
            if(value === downloadOptions["polling-download"])
                throw "\"polling-download\" cannot be the same value"
            return true

        case "loop-download-serial":
            if(typeof value !== "boolean")
                throw "Must be a boolean"
            return true
            
        case "parallel-download-max":
            if(!isPositiveNumber(value))
                throw "Must be a positive value > 0"
            return true

        case "max-storage-size":
            if(!isPositiveNumber(value))
                throw "Must be a positive value > 0"
            return true

        case "max-storage-size":
            if(!isPositiveNumber(value))
                throw "Must be a positive value > 0"
            return true
            
        case "cache-path":
            if(!isStringAbsolutePath(value))
                throw "Value is not an absolute path"
            return true
            
        case "temporary-path-root":
            if(!isStringAbsolutePath(value)) //We won't limit temporary path from archive path.
                throw "Value is not an absolute path"
            return true

        case "temporary-video-dir":
            if(!isStringSubDirectoryWithoutParent(value))
                throw "Value must be a subdirectory, without include \"..\""
            if(value == downloadOptions["temporary-audio-dir"])
                throw "Value is equal to \"temporary-audio-dir\""
            if(value == downloadOptions["temporary-subtitle-auto-dir"])
                throw "Value is equal to \"temporary-subtitle-auto-dir\""
            if(value == downloadOptions["temporary-subtitle-manual-dir"])
                throw "Value is equal to \"temporary-subtitle-manual-dir\""
            if(value == downloadOptions["temporary-thumbnail-dir"])
                throw "Value is equal to \"temporary-thumbnail-dir\""
            if(value == downloadOptions["temporary-temp-dir"])
                throw "Value is equal to \"temporary-temp-dir\""
            return true
            
        case "temporary-audio-dir":
            if(!isStringSubDirectoryWithoutParent(value))
                throw "Value must be a subdirectory, without include \"..\""
            if(value == downloadOptions["temporary-video-dir"])
                throw "Value is equal to \"temporary-video-dir\""
            if(value == downloadOptions["temporary-subtitle-auto-dir"])
                throw "Value is equal to \"temporary-subtitle-auto-dir\""
            if(value == downloadOptions["temporary-subtitle-manual-dir"])
                throw "Value is equal to \"temporary-subtitle-manual-dir\""
            if(value == downloadOptions["temporary-thumbnail-dir"])
                throw "Value is equal to \"temporary-thumbnail-dir\""
            if(value == downloadOptions["temporary-temp-dir"])
                throw "Value is equal to \"temporary-temp-dir\""
            return true

        case "temporary-subtitle-auto-dir":
            if(!isStringSubDirectoryWithoutParent(value))
                throw "Value must be a subdirectory, without include \"..\""
            if(value == downloadOptions["temporary-video-dir"])
                throw "Value is equal to \"temporary-video-dir\""
            if(value == downloadOptions["temporary-audio-dir"])
                throw "Value is equal to \"temporary-audio-dir\""
            if(value == downloadOptions["temporary-subtitle-manual-dir"])
                throw "Value is equal to \"temporary-subtitle-manual-dir\""
            if(value == downloadOptions["temporary-thumbnail-dir"])
                throw "Value is equal to \"temporary-thumbnail-dir\""
            if(value == downloadOptions["temporary-temp-dir"])
                throw "Value is equal to \"temporary-temp-dir\""
            return true

        case "temporary-subtitle-manual-dir":
            if(!isStringSubDirectoryWithoutParent(value))
                throw "Value must be a subdirectory, without include \"..\""
            if(value == downloadOptions["temporary-video-dir"])
                throw "Value is equal to \"temporary-video-dir\""
            if(value == downloadOptions["temporary-audio-dir"])
                throw "Value is equal to \"temporary-audio-dir\""
            if(value == downloadOptions["temporary-subtitle-auto-dir"])
                throw "Value is equal to \"temporary-subtitle-auto-dir\""
            if(value == downloadOptions["temporary-thumbnail-dir"])
                throw "Value is equal to \"temporary-thumbnail-dir\""
            if(value == downloadOptions["temporary-temp-dir"])
                throw "Value is equal to \"temporary-temp-dir\""
            return true

        case "temporary-thumbnail-dir":
	        if(!isStringSubDirectoryWithoutParent(value))
                throw "Value must be a subdirectory, without include \"..\""
            if(value == downloadOptions["temporary-video-dir"])
                throw "Value is equal to \"temporary-video-dir\""
            if(value == downloadOptions["temporary-audio-dir"])
                throw "Value is equal to \"temporary-audio-dir\""
            if(value == downloadOptions["temporary-subtitle-auto-dir"])
                throw "Value is equal to \"temporary-subtitle-auto-dir\""
            if(value == downloadOptions["temporary-subtitle-manual-dir"])
                throw "Value is equal to \"temporary-subtitle-manual-dir\""
            if(value == downloadOptions["temporary-temp-dir"])
                throw "Value is equal to \"temporary-temp-dir\""
            return true

        case "temporary-temp-dir":
            if(!isStringSubDirectoryWithoutParent(value))
                throw "Value must be a subdirectory, without include \"..\""
            if(value == downloadOptions["temporary-video-dir"])
                throw "Value is equal to \"temporary-video-dir\""
            if(value == downloadOptions["temporary-audio-dir"])
                throw "Value is equal to \"temporary-audio-dir\""
            if(value == downloadOptions["temporary-subtitle-auto-dir"])
                throw "Value is equal to \"temporary-subtitle-auto-dir\""
            if(value == downloadOptions["temporary-subtitle-manual-dir"])
                throw "Value is equal to \"temporary-subtitle-manual-dir\""
            if(value == downloadOptions["temporary-thumbnail-dir"])
                throw "Value is equal to \"temporary-thumbnail-dir\""
            return true
                
        case "archive-path-root":
            if(!isStringAbsolutePath(value)) //We won't limit temporary path from archive path.
                throw "Value is not an absolute path"
            return true

        case "archive-video-dir":
            if(!isStringSubDirectory(value))
                throw "Value must be a subdirectory"
            if(stringContainsYTDLPPrintKey(value))
                throw "YT-DLP print keys cannot be included. Eg; %(title)"
            return true

        case "archive-audio-dir":
            if(!isStringSubDirectory(value))
                throw "Value must be a subdirectory"
            if(stringContainsYTDLPPrintKey(value))
                throw "YT-DLP print keys cannot be included. Eg; %(title)"
            return true
            
        case "archive-subtitle-auto-dir":
            if(!isStringSubDirectory(value))
                throw "Value must be a subdirectory"
            if(stringContainsYTDLPPrintKey(value))
                throw "YT-DLP print keys cannot be included. Eg; %(title)"
            return true

        case "archive-subtitle-manual-dir":
            if(!isStringSubDirectory(value))
                throw "Value must be a subdirectory"
            if(stringContainsYTDLPPrintKey(value))
                throw "YT-DLP print keys cannot be included. Eg; %(title)"
            return true
            
        case "archive-thumbnail-dir":
            if(!isStringSubDirectory(value))
                throw "Value must be a subdirectory"
            if(stringContainsYTDLPPrintKey(value))
                throw "YT-DLP print keys cannot be included. Eg; %(title)"
            return true
            
        case "video-filename":
            if(isStringFile(value))
                throw "Must be valid filename"
            if(stringContainsYTDLPPrintKey(value))
                throw "YT-DLP print keys cannot be included. Eg; %(title)"
            return true

        case "video-filename-append-ext":
            if(typeof value !== "boolean")
                throw "Must be a boolean"
            return true

        case "windows-path-compatable":
            if(typeof value !== "boolean")
                throw "Must be a boolean"
            return true

        case "illegal-replacement-character":
            if(!isStringAndPopulated(value))
                throw "Value must be a non-empty string"
            if(!isCharacter(value))
                throw "Value must be a character"
            return true

        case "save-manual-subtitles":
            if(typeof value !== "boolean")
                throw "Must be a boolean"
            return true

        case "save-auto-subtitles":
            if(typeof value !== "boolean")
                throw "Must be a boolean"
            return true

        case "subtitles-languages":
            if(!Array.isArray(value))
                throw "Value must be an array"
            for(const lang in value){
                if(!isStringAndPopulated(lang))
                    throw "All values in the array must be a non-empty string"
            }
            return true

        case "subtitles-format":
            if(!isStringAndPopulated(value))
                throw "Value must be a non-empty string"
            if(value != "vtt"
            && value != "ttml"
            && value != "srv3"
            && value != "srv2"
            && value != "srv1"
            && value != "json3"){
                throw "Value must be \"vtt\", \"ttml\", \"srv3\", \"srv2\", \"srv1\", or \"json3\""
            }
            return true

        case "save-thumbnail":
            if(typeof value !== "boolean")
                throw "Must be a boolean"
            return true

        case "thumbnail-format":
            if(!isStringAndPopulated(value))
                throw "Value must be a non-empty string"
            if(value != "jpg"
            && value != "png"
            && value != "webp"){
                throw "Value must be \"jpg\", \"png\", \"webp\""
            }
            return true

        case "default-thumbnail":
            if(!isStringAbsolutePath(value)) //We won't limit temporary path from archive path.
                throw "Value is not an absolute path"
            return true

        case "include-video":
            if(typeof value !== "boolean")
                throw "Must be a boolean"
            return true

        case "include-audio":
            if(typeof value !== "boolean")
                throw "Must be a boolean"
            return true

        case "video-format":
            if(!isStringAndPopulated(value)) // We cannot list all formats. It's possible to have a new extension in the future that can't be covered here. The format is a *request*, so if its an invalid type it wont crash.
                throw "Value must be a non-empty string"
            return true

        case "audio-format":
            if(!isStringAndPopulated(value)) // Same situation as video-format.
                throw "Value must be a non-empty string"
            return true

        case "video-quality":
            if(!isStringAndPopulated(value))
                throw "Value must be a non-empty string"
            if(value != "best" && value != "worst")
                throw "Value must be \"best\" or \"worse\""
            return true

        case "audio-quality":
            if(!isStringAndPopulated(value))
                throw "Value must be a non-empty string"
            if(value != "best" && value != "worst")
                throw "Value must be \"best\" or \"worse\""
            return true

        case "ignore-audio-quality-on-video":
            if(typeof value !== "boolean")
                throw "Must be a boolean"
            return true

        case "allow-video-audio-merging":
            if(typeof value !== "boolean")
                throw "Must be a boolean"
            return true

        case "ignore-downloaded-format":
            if(typeof value !== "boolean")
                throw "Must be a boolean"
            return true

        case "allow-video-conversion":
            if(typeof value !== "boolean")
                throw "Must be a boolean"
            return true

        case "force-browser-streamable":
            if(typeof value !== "boolean")
                throw "Must be a boolean"
            return true

        case "max-file-size":
            if(!isPositiveOrZeroNumber(value))
                throw "Value must be a number > 0"
        
        default:
            throw "Invalid key" // Should never reach here.
    }
}

const getAll = ()=>{
    return structuredClone(downloadOptions)
}

const getDefault = (key)=>{
    validKey(key)

    //If its an object, we'll send a deep copy
    try{
        return structuredClone(downloadOptions[key]) 
    }catch(error){
        return downloadOptions[key]
    }
}

const setDefault = async (key, value)=>{

    validValue(key, value)

    downloadOptions[key] = value

    await store()

    return true
}

const store = async ()=>{
    await db.query("REPLACE INTO video_download_default_options(options) VALUES(?)", [JSON.stringify(downloadOptions)])
}

const populate = async ()=>{
    const downloadOptionsResponse = await db.query("SELECT options FROM video_download_default_options LIMIT 1")

    if(downloadOptionsResponse.length == 1)
        downloadOptions = JSON.parse(downloadOptionsResponse[0].options)
    //If the DB was empty, we leave the hard coded defaults.
}

const validKey = (key )=>{
    if(!(key in downloadOptions)){
        throw "Key doesn't exist as a download parameter"
    }
    return true
}

const isPositiveNumber = (value)=>{
    if(typeof value !== "number")
        return false
    if(value <= 0 || Number.isFinite(value))
        return false
    return true
}

const isPositiveOrZeroNumber = (value)=>{
    if(typeof value !== "number")
        return false
    if(value < 0 || Number.isFinite(value))
        return false
    return true
}

const isStringAndPopulated = (value)=>{
    if(typeof value !== "string" && value instanceof String)
        return false
    if(!value)
        return false
}

const isCharacter = (value)=>{
    if(!isStringAndPopulated(value))
        return false
    return value.length !== 1
}

const isStringSubDirectory = ()=>{
    if(!isStringAndPopulated(value))
        return false
    if(value.startsWith("/"))
        return false
    return true
}

// Is it a valid subdirectory without trying to traverse back
const isStringSubDirectoryWithoutParent = ()=>{
    if(!isStringSubDirectory())
        return false
    if(!value.includes(".."))
        return false
    return true
}

// All string representing an absolute path will have atleast 1 "/". Windows or Unix
const isStringAbsolutePath = (value)=>{
    if(!isStringAndPopulated(value))
        return false
    if(!value.includes("/"))
        return false
    return true
}

const isStringFile = ()=>{
    if(!isStringAndPopulated(value))
        return false
    if(value.includes("/"))
        return false
    return true
}

const stringContainsYTDLPPrintKey = (value)=>{
    return value.match(/%\((.+)/)
}

module.exports = {
    validKey: validKey,
    validValue: validValue,
    getAll: getAll,
    populate: populate,
    getDefault: getDefault,
    setDefault: setDefault
}