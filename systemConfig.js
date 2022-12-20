//Configuration for system related options
//Requires restart after change
const systemOptions = {}

//yt-dlp binary location
systemOptions["ytdlp-bin"] = "yt-dlp"

//Database type
systemOptions["database-type"] = "sqlite" // Swapping types requires the DB either copied or setup. None of that is automatic. Related options below must be setup. Possible input: mysql, sqlite

//Mysql database info
systemOptions["mysql-db-host"] = "127.0.0.1"
systemOptions["mysql-db-user"] = "ytdlpd"
systemOptions["mysql-db-pass"] = ""
systemOptions["mysql-db-db"] = "ytdlpd"

//Sqlite database info
systemOptions["sqlite-file"] = "" // Must be absolute path.

//Channel polling
systemOptions["polling-time-channel"] = 1 // Heartbeat (in minutes) of channel polling function. High intervals can miss videos, but low values can get your IP blocked.
systemOptions["autostart-polling-channel"] = true  // Start polling for video downloads on boots

//Polling downloads
systemOptions["polling-download"] = false // When looking for the next video to download, should the polling method be used? This will look for a new video on a fix interval. This, or "loop-download" must be true. Both cannot be true.
systemOptions["polling-time-download"] = 0.005 // Heartbeat (in minutes) of polling video download function
systemOptions["autostart-polling-download"] = true // Start polling for channels on boot
systemOptions["polling-download-serial"] = false // Will the polling system operate in a serial mode? The next polling function will not be called until the previous has returned. It will wait one whole "polling-time-video". Otherwise, it'll run parallel and download even if another is downloading.

//Loop downloads
systemOptions["loop-download"] = true // This will cause the system to run a loop of downloading videos until it runs out. This auto-restarts when another is added. This, or "polling-download" must be true. Both cannot be true.
systemOptions["loop-download-serial"] = false // If the system is currently downloading a video, do you want it to wait for that download to complete and automatically call the new download to start?

//Parallel downloads
systemOptions["parallel-download-max"] = 5 // The amount of concurrent downloads allowed to occur.

//Maximum allowed storage
systemOptions["max-storage-size"] = 500 // Gigabytes
systemOptions["max-storage-size"] *= 1024 * 1024 * 1024 // MB * KB * B

//Quota
systemOptions["max-quota"] = 100 // Gigabytes. The maxium amount that will be downloaded before refusing. If this higher than "max-storage-size" we will use "max-storage-size"

const get = (key)=>{
    return systemOptions[key]
}

module.exports = {
    get: get
}