//Handles all channel related functions
const db = require("./database")
const ytch = require("yt-channel-info")

//Non-cache requests will query from the live page. Cached request will pull from DB.
//ChannelId must be a "Channel Id" type. Not username. 
const getChannelInfo = async (channelId, cache=false)=>{
    try{
        if(cache){

            const results = await db.query("SELECT meta FROM channel_meta WHERE channelId = ?",[channelId])

            if(results.length != 1)
                throw new Error("No channel info has been cached")

            try{
                return JSON.parse(results.meta)
            }catch(jsonErr){
                throw new Error(jsonErr)
            }

        }else{
            //Request the base channel info
            let channelInfo = await ytch.getChannelInfo({channelId:channelId, channelIdType: 1})

            if(channelInfo.alertMessage)
                throw new Error(response.alertMessage)

            //Request the remaining list of related channels
            let continuation = channelInfo.relatedChannels.continuation;
            while(continuation){
                const relatedChannelResp = await ytch.getRelatedChannelsMore({continuation: continuation})

                channelInfo.relatedChannels.items.concat(relatedChannelResp.items)

                continuation = relatedChannelResp.continuation
            }

            return channelInfo
        }
    }catch(err){
        //Do not return even partial results. (If failed on a continuation request)
        throw new Error(err)
    }
}

//Requests live channel data then stores in DB
//ChannelId must be a "Channel Id" type. Not username. 
const cacheChannelInfo = async (channelId)=>{
    try{
        const channelInfo = JSON.stringify(await getChannelInfo(channelId))

        const results = await db.query("INSERT INTO channel_meta(channelId, meta) VALUES (?, ?) ON DUPLICATE KEY UPDATE channelId = ?",[channelId, channelInfo, channelInfo])

        if(results.affectedRows != 1)
            throw new Error("Channel Info Cache Error - Internal DB error.")

        return
    }catch(err){
        return reject(err)
    }
}

//We do not cache video lists, as channels will upload/remove videos constantly. 
//if it's removed before we download it, a video list will not be usable. 
//Requests channels video list live.
//ChannelId must be a "Channel Id" type. Not username. 
const getChannelVideosList = async (channelId)=>{
    try{
        let videoList = []

        let videoListResp = await ytch.getChannelVideos({channelId: channelId, channelIdType: 1})

        videoList.concat(videoListResp.items)

        //Previous request will not always return the full list
        //Collect remaining results
        while(videoListResp.continuation){
            videoListResp = await ytch.getChannelVideosMore({continuation: videoListResp.continuation})

            videoList.concat(videoListResp.items)
        }

        return videoList
    }catch(err){
        //Do not return even partial results. (If failed on a continuation request)
        throw new Error(err)
    }
}

// youtube.com/user/*
const userIdToChannelId = async (userId)=>{
    try{
        //Request the base channel info
        let channelInfo = await ytch.getChannelInfo({channelId:userId, channelIdType: 2})
                    
        if(channelInfo.alertMessage)
            throw new Error(response.alertMessage)

        return channelInfo.authorId
    }catch(err){
        throw new Error(err)
    }
}

// youtube.com/c/*
const nameIdToChannelId = async (nameId)=>{
    try{
        //Request the base channel info
        let channelInfo = await ytch.getChannelInfo({channelId:nameId, channelIdType: 3})
                    
        if(channelInfo.alertMessage)
            throw new Error(response.alertMessage)

        return channelInfo.authorId
    }catch(err){
        throw new Error(err)
    }
}

//Extracts out the nameid/userid/channelid, and returns the channel ID
const urlToChannelId = async (url)=>{
    try{
        const urlParsed = new URL(url)

        // Youtu.be does not handle channels
        if( urlParsed.hostname != "www.youtube.com"
            && urlParsed.hostname != "youtube.com"
            && urlParsed.hostname != "m.youtube.com")
            throw new Error("Invalid URL - Not a Youtube link.")

        const path = urlParsed.pathname.split('/')
        
        if(path.length != 2)
            throw new Error("Invalid URL - Invalid Path")

        switch(path[0]){
            case "channel":{
                return await getChannelInfo(path[1])
            }

            case "user":{
                const channelId = await userIdToChannelId(path[1])
                return await getChannelInfo(channelId)
            }

            case "c":{
                const channelId = await nameIdToChannelId(path[1])
                return await getChannelInfo(channelId)
            }
        }

        throw new Error("Invalid URL - Could not find channel")
    }catch(err){
        throw new Error(err)
    }
}


module.exports = {
    getChannelInfo: getChannelInfo,
    cacheChannelInfo: cacheChannelInfo,
    getChannelVideosList: getChannelVideosList,
    userIdToChannelId: userIdToChannelId,
    nameIdToChannelId: nameIdToChannelId,
    urlToChannelId: urlToChannelId
}
