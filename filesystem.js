//Manages storage
const diskSpace = require("check-disk-space").default
const fs = require("fs")
const pathParse = require("path")

const validatePath = (path) => {
    if(pathExistsWithAccess(path))
        return true
    else
        try{
            fs.mkdirSync(path, {recursive: true})
            return true
        }catch(error){
            return false
        }
}

// Checks if both temporary and archive storage are on the same drive
const isCacheAndArchiveShared = async (cache, archive)=>{
    const cacheDrive = await diskSpace(cache)
    const archiveDrive = await diskSpace(archive)

    if(cacheDrive.diskPath === archiveDrive.diskPath)
        return true
    else
        return false
}

// Remaining available storage space of drive for "path". Does not include quota
const remainingStorageOnPath = async (path)=>{
    return (await diskSpace(pathParse.resolve(path))).free
}

// Alias for constistancy
const fileExistsWithAccess = (file)=>{
    return pathExistsWithAccess(file)
}

// Sync check if path exists and you have R/W access
const pathExistsWithAccess = (path)=>{
    try{
        if(fs.existsSync(path)){
            fs.accessSync(path)
            return true
        }
        return false
    }catch(error){
        return false
    }
}

//Sum of all files in path
const sizeOfPath = async (path)=>{
    const dirContents = await fs.promises.readdir(path, {
        withFileTypes: true
    })

    let totalSize = 0

    for(const file of dirContents)
        if(file.isFile()){
            const fileStats = await fs.promises.stat(path + "/" + file.name)

            totalSize += fileStats.size
        }
    
    return totalSize
}

const sizeOfFile = async (file)=>{
    if(fs.existsSync(file))
        fs.accessSync(file)

    const fileStats = await fs.promises.stat(file)

    return fileStats.size
}

const validateFilename = (filename, replaceToken="") => {
    filename = filename.replaceAll("/", replaceToken)
    return filename
}

const windowsPathNameCleanup = (path, replacementCharacter="_", ignoreSlash=false) =>{
    let pathList = (ignoreSlash?[path]:path.split("/"))

    let directorySplit = pathList.map((directory)=>{
		if(directory.match(/^(con|prn|aux|nul|com[0-9]|lpt[0-9])$/ig)){
			return "_"+directory
		}

		return directory.replace(/([<>:"\/\\|?*])|(\.|\s)$/ig, replacementCharacter)
	})

    return directorySplit.join("/")
}

module.exports = {
    remainingStorageOnPath: remainingStorageOnPath,

    isCacheAndArchiveShared: isCacheAndArchiveShared,

    fileExistsWithAccess: fileExistsWithAccess,
    pathExistsWithAccess: pathExistsWithAccess,

    sizeOfPath: sizeOfPath,
    sizeOfFile: sizeOfFile,

    validateFilename: validateFilename,
    validatePath: validatePath,

    windowsPathNameCleanup: windowsPathNameCleanup
}