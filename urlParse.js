//Parses the URL submitted by users. 

// Does the string represent a proper URL
const validUrl = (url)=>{
    try {
        new URL(url);
        return true;
    }catch(error){
        return false;
    }
}

//Returns a string representing the URL type.
//Either, "youtube" for video, or "general"
const urlType = (url)=>{
    const urlParsed = new URL(url)

    if(validYoutubeDomains.includes(hostToDomain(urlParsed.host)))
        //If we cannot extract a video ID, it must be a non-video resource being downloaded from youtube.
        try{
            getYoutubeVideoId(url)
            return "youtube"
        }catch(error){
            return "general"
        }
    else
        return "general"
}

const getYoutubeVideoId = (url)=>{
    const urlParsed = new URL(url)

    const domain = hostToDomain(urlParsed.host)

    if(!validYoutubeDomains.includes(domain))
        throw "Not a Youtube domain"

    try{
        let videoIdRegex

        //Shortened youtube links follow unique format
        if(domain === "youtu.be")
            videoIdRegex = /\/([^&?%#\/\n]*)/
        else
            videoIdRegex = /.*(?:v=|v%3D|v\/|(?:a|p)\/(?:a|u)\/\d.*\/|watch\?|vi(?:=|\/)|\/embed\/|oembed\?)([^&?%#\/\n]*)/

        const videoId = (urlParsed.pathname + urlParsed.search).match(videoIdRegex)[1]

        return videoId
    }catch(error){
        throw "Could not get video ID"
    }
}

const hostToDomain = (host)=>{
    return host.replace(/^[^.]+\./g, "")
}

const validYoutubeDomains = [
    "youtu.be", "youtube.ae", "youtube.at",
    "youtube.az", "youtube.ba", "youtube.be",
    "youtube.bg", "youtube.bh", "youtube.bo",
    "youtube.by", "youtube.ca", "youtube.cat",
    "youtube.ch", "youtube.cl", "youtube.co",
    "youtube.co.ae", "youtube.co.at", "youtube.co.cr", 
    "youtube.co.hu", "youtube.co.id", "youtube.co.il",
    "youtube.co.in", "youtube.co.jp", "youtube.co.ke",
    "youtube.co.kr", "youtube.co.ma", "youtube.co.nz",
    "youtube.co.th", "youtube.co.tz", "youtube.co.ug",
    "youtube.co.uk", "youtube.co.ve", "youtube.co.za",
    "youtube.co.zw", "youtube.com", "youtube.com.ar",
    "youtube.com.au", "youtube.com.az", "youtube.com.bd",
    "youtube.com.bh", "youtube.com.bo", "youtube.com.br",
    "youtube.com.by", "youtube.com.co", "youtube.com.do",
    "youtube.com.ec", "youtube.com.ee", "youtube.com.eg", 
    "youtube.com.es", "youtube.com.gh", "youtube.com.gr",
    "youtube.com.gt", "youtube.com.hk", "youtube.com.hn",
    "youtube.com.hr", "youtube.com.jm", "youtube.com.jo",
    "youtube.com.kw", "youtube.com.lb", "youtube.com.lv",
    "youtube.com.ly", "youtube.com.mk", "youtube.com.mt",
    "youtube.com.mx", "youtube.com.my", "youtube.com.ng",
    "youtube.com.ni", "youtube.com.om", "youtube.com.pa",
    "youtube.com.pe", "youtube.com.ph", "youtube.com.pk",
    "youtube.com.pt", "youtube.com.py", "youtube.com.qa",
    "youtube.com.ro", "youtube.com.sa", "youtube.com.sg",
    "youtube.com.sv", "youtube.com.tn", "youtube.com.tr",
    "youtube.com.tw", "youtube.com.ua", "youtube.com.uy",
    "youtube.com.ve", "youtube.cr", "youtube.cz",
    "youtube.de", "youtube.dk", "youtube.ee",
    "youtube.es", "youtube.fi", "youtube.fr",
    "youtube.ge", "youtube.gr", "youtube.gt",
    "youtube.hk", "youtube.hr", "youtube.hu",
    "youtube.ie", "youtube.in", "youtube.iq",
    "youtube.is", "youtube.it", "youtube.jo",
    "youtube.jp", "youtube.kr", "youtube.kz",
    "youtube.la", "youtube.lk", "youtube.lt",
    "youtube.lu", "youtube.lv", "youtube.ly",
    "youtube.ma", "youtube.me", "youtube.mk",
    "youtube.mx", "youtube.my", "youtube.ng",
    "youtube.ni", "youtube.nl", "youtube.no",
    "youtube.pa", "youtube.pe", "youtube.ph",
    "youtube.pk", "youtube.pl", "youtube.pr",
    "youtube.pt", "youtube.qa", "youtube.ro",
    "youtube.rs", "youtube.ru", "youtube.sa",
    "youtube.se", "youtube.sg", "youtube.si",
    "youtube.sk", "youtube.sn", "youtube.sv",
    "youtube.tn", "youtube.ua", "youtube.ug",
    "youtube.uy", "youtube.vn", "youtube-nocookie.com"
]

module.exports = {
    validUrl: validUrl,
    urlType: urlType,
    getYoutubeVideoId: getYoutubeVideoId
}