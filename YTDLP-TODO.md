- Reduce number of http requests
    - When downloading youtube video, store and cache video meta at same time.
        - downloadVideoMeta will pull from cache, or download if non-existant
    - 

- Each "addDownload" will contain a option object
    - Each property of the object will correlate to a flag of the youtube-dl execution
    - Gives user more control over options. Can easily be mapped to a UI

- Verify config in config.js
    - run each call? 
    - Write function to intake an object that verifys it all. 
        - Can be used during the "set" of each value. 

- Setup Sponsorblock
    - download all the marks,
    - ffmpeg to remove segments?

- Handle Livestreams

- Handle scheduled videos
    - --wait-for-video MIN[-MAX]

- Rate limiter
    - Check "Workarounds" notes in man file

- Functions to get list of available subtitles.
    - --list-subs

- Master logging and error handling system

- download.js line26 - verify they print with complete directory
    - prefix directory otherwise

- Download.js - downloadGeneral
    - Implements options

- If allow-file-conversion is disabled, do not download anything besides that file format. 
    - Modify generateYoutubeDLOptions -> generateFormat, so it doesn't attempt to download other formats (if not converting)
    - Same applies to music

- Handle offline.
    - Server has disconnected from the internet? Show warnings, pass back warnings of that.

- Ability to cancel youtube downloads, mid download
    - Convert to class? Deconstruct cleans up temp files?

- downloadProcessor
    - Handle automatic generated subtitles
        - Hard to differentiate from human generated. Also many different types of generated ones. Eg: 1 language -> 2nd language

- Change to sqlite
    - Project is not designed for production use
    - Better to be easily portable, and ship with a barebone DB structure, instead of a sql creation file. 

- Validate all input parameters of addDownload

- max-storage-size config. Move the calculations into the functions used. Do not calculate in config file.

- "The -o option is used to indicate a template for the output file names while -P option is used to specify the path each type of file should be saved to."
    - Verify all updated

- Split out DB config
    - Seperate download requests configs

- Downloadprocessor - when adding subtitle meta data, do not add subtitles if already existing.
    - Check if any requested files already exist (if redownloading) before downloading.
        - At beginning of handleVideoDownload. Remove already downloaded files.

- maxFileSize: if file was converted, confirm file size

- downloadNext: Move all the folder validation, to a initialization function.
    - Call only once, from the start of the polling function. 
    - Folder wont need to constantly checked everytime.
    - Clear temp folder

- Cache meta response in downloader.js
    - Set max to cache?
    - Store in DB?
    - Organize by videoId/Request option]
        - Different options will result in different meta with same videoId

- Consider using ytdlp to move files to their final locations
    - Check if the storage manager can still regulate the remaining space

- Fix directory name processing
    - video_format_meta meta data has unprocessed directories
        - Eg: "archive-video-dir": "$uploader/video" under formatId #8
        - **** PROBABLY not an error. Simply storing the request as-is

- DownloadManager.refreshMeta
    - Doesn't download new files or format.
        - Only updates the meta data
        - Downloadprocessor.handlevideo can split its meta processing into a seperate function

- Split up downloadProcessor into video handler, subtitle handler, thumbnail handler, etc
    - If any section was previously download (with same options), remove that section to be downloaded
        - Eg:   Previously downloaded a video with quality #1, and EN subtitle, but FR subtitles along side the previous options was submitted again
                The processor should skip the video, and EN subtitle re-download. Only FR subtitles should be downloaded

- Fix error handling entirely. Try/catch are all over the place

- Thumbnail should only exist once. Delete previous and replace with new if redownloaded or different format

- https://www.reddit.com/r/DataHoarder/comments/z1pewc/anyone_got_a_ytdlp_command_for_getting_a_channels/

- Implement do-not-use-temporary-dir
    - Simply overwrite the temporary directory to the archive directory.
    - Renaming/moving can still occur. Nothing will occur

- Download progress
    - --progress-template [TYPES:]TEMPLATE
    - --progress


- Config validation function does NOT need to check for permission to write.
    - Downloader will validate that.

- Implement "cache-dir"
    - --cache-dir DIR
    - Validate write permission

- Move downloader.validate() to storage.js

- downloadManager.downloadNext should handle all meta upload to DB. Processor only processes data.

- verify config["video-filename-append-ext"]

- config["max-file-size"]
    - --max-filesize SIZE

- downloadVideo needs to handle a callback stream for passing info back
    - Perhaps the callee can pass their stream and we will store their stream inside a global "logging" module.
    - Errors will handle in the same manor on a second stream
    - Optional config to store all errors in DB/file
    - Implement on downloader.download
        -  case "PROGRESS":

- Handle audio only downloads
    - special format meta data to describe as audio file
    - check to move to audio directory instead of video directory

- Verify not downloading subtitles multiple times

- Move "validateFolders"'s internal function into a general.js
    - Do not need to rewrite the same code

- Implement specific format option

- thumbanil being downloaded multiple times for same thumbnail
    - either replace, or skipdownloading

- Handle stderr on downloader
    - force user to make streams for stdout and stderr
    - perhaps each request keeps the streamed data in a DB
        - all requests can read their info/errors at any time
        - allows users to force download in queue

- Permissions/user issues
    - write files/folders as user
    - change permissions of file/folders
    - set via config

- Convert downloadQueueData in downloadManager to a class

- Handle no audio or video downloads

- Do a single or parallel mode.
    - set server option to download in paralell or serial
    - lock the polling until current running allowing next to go
    - if setup in parallel, no limits. Simply call the downloadnext and return.
    - Possible to setup a max number
        - track number of "locks" placed. Wait until below max


- split up config options
    - download options
    - server options

- handle cancel event
    - setup the canceltrigger event for execa
    - you cannot cancel when its moving/processing data
    - perhaps if called during moving/processing, it'll continue BUT delete everything after

- Implement 'polling-download' and 'callback-download'
    - main.js will have a function to change. It'll swap between the 2 types

- System logger
    - create it in main
    - store in general.js
    - const {systemLog} = require("./general")

- isStringAbsolutePath
    - All unix strings must start with "/"
    - All windows must start with (letter):/

- Clean up on errors
    - an object in downloader and downloadProcessor with keys based off download ID
    - the key will store progress made. 
        - I.e; you moved  video, write it down, it tried to move but failed, so you dont write down that move
        - You can follow this list, and undo what was done
        - Mark if successful. Clean up temp files

- Remove general.js
    - move all functions into proper places
        - functions related to fs, should be in stroage. (rename to filesystem.js)

- In downloadparameters
    - move the throws from the if() checks, to directly in the function
    - Not repeating code

- Implement max-quota in systemConfig
    - Each download adds to the quota count
    - CHekc if above quota before download

- Read https://github.com/nbr23/youtube-dl-server 
    - Find all issues, implement requests
    - Copy features
    - https://www.reddit.com/r/youtubedl/comments/i062oh/youtubedlserver_a_program_ive_been_working_on_for/
        - Find all related projects
        - Find complaints and fix.

- Remove all commented out downloadOPtions from "validValue"

- Implement "delete" from downloadManager
    - remove all files and DB data

- Implement a webapi. 
    - restful https://medium.com/@maybekatz/introducing-npx-an-npm-package-runner-55f7d4bd282b
    - npx to spin once(?)

- Handle playlists
    - submit whole playlist, auto add everything to queue
    - submit list, get a list of videos in list
        - users can pick/choose what they want

- "subscribe" to playlists
    - You can subscribe to a playlist like you would a channel
        - This will auto add new videos to the queue
        - Checking for duplicates of channels will need to be done
            - No error messages to throw back to the user

- urlToChannelId in channel.js
    - fix all the related domains
    - use urlParse

- Run eslint

- Setup npm start scripts
    - Auto installs depends

- Options to only download filtered out videos from subscriptions
    - Eg; only download titles from my subscriptions that contain "breaking news"
    - Record skipped videos