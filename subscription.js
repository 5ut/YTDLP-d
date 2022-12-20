//Handles user subscriptions.
const config = require("./downloadOptions")
const db = require("./database")

let subListData = {}
let subListIndex = []

//ChannelId must be a "Channel Id" type. Not username. 
//Channel Id's are not validated.
const addSubscription = async (channelId)=>{
    try{
        //Already subscribed?
        if(subListData[channelId])
            return

        let results = await db.query("INSERT IGNORE INTO subscriptions(channelid) VALUES (?)",[channelId])

        if(results.affectedRows != 1)
            throw new Error("Failed to add subscription - Internal DB error")

        //We renew the subscription list
        await setSubscriptions()
        
        return
    }catch(err){
        return reject(err)
    }
}

//ChannelId must be a "Channel Id" type. Not username. 
//Channel Id's are not validated.
const removeSubscription = async (channelId)=>{
    try{
        if(!subListData[channelId])
            return

        let results = await db.query("DELETE FROM subscriptions WHERE channelid = ?",[channelId])

        if(results.affectedRows != 1)
            throw new Error("DB Error - Failed to remove subscription")

        //We renew the subscription list
        await setSubscriptions()
        
        return
    }catch(err){
        throw new Error(err)
    }
}

const setSubscriptions = async ()=>{
    try{
        let subListDataTmp = {}
        let subListIndexTmp = []

        const results = await db.query("SELECT id, channelid from subscriptions")

        for(const result of results){
            //All channelId's are guarenteed unique
            subListIndexTmp.push(result.channelid)
            subListDataTmp[result.channelid] = {id: result.id}
        };

        subListData = subListDataTmp
        subListIndex = subListIndexTmp

        return
    }catch(err){
        throw new Error(err)
    }
}

const populate = async ()=>{
    try{
        await setSubscriptions()
        return
    }catch(err){
        throw new Error(err)
    }
}

const getSubscriptions = ()=>{
    return subListIndex
}

module.exports = {
    getSubscriptions: getSubscriptions,
    addSubscription: addSubscription,
    removeSubscription: removeSubscription,
    populate: populate
}