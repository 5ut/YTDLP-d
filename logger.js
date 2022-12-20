const { Readable } = require('node:stream');

//Basic logging system to store each respective messages
class Logger {
	#errorLogs
    #errorLogsReady
	#errorStream

	#infoLogs
    #infoLogsReady
	#infoStream

	#debugLogs
    #debugLogsReady
	#debugStream

    #closed

	constructor(){
		this.#registerStreams()
	}

	#registerStreams(){
		this.#errorLogs = []
		this.#infoLogs = []
		this.#debugLogs = []

        //This is a place holder for a callback that will be called by the
        //message functions. This will force it to wait for a message to push. 
        //Normally, it will look for a message and never resolve, because its synchronous 
        //and has no way to "wait" for data to arrive in. This method also doesn't expose 
        //internal readable stream data, and only will only allow data to be read when readable
        //is ready for more instead of forcing more. 
        this.#errorLogsReady = ()=>{}
        this.#infoLogsReady = ()=>{}
        this.#debugLogsReady = ()=>{}

		this.#errorStream = this.#getNewStream(this.#errorLogs, (readyCallback)=>{this.#errorLogsReady=readyCallback})
		this.#infoStream =  this.#getNewStream(this.#infoLogs, (readyCallback)=>{this.#infoLogsReady=readyCallback})
		this.#debugStream = this.#getNewStream(this.#debugLogs, (readyCallback)=>{this.#debugLogsReady=readyCallback})

        this.#closed = false
	}

	#getNewStream(queue, readyCallback){
        let currentPosition = 0

		return new Readable({
			objectMode: true,
			read(size){
                const pushWrapper = ()=>{
                    this.push(queue[currentPosition].message)
                    currentPosition++
                }

                if(queue.length == currentPosition){
                    readyCallback(()=>{
                        readyCallback(()=>{})
                        pushWrapper()
                    })
                    return
                }

                pushWrapper()
			},
			destroy(error, callback){
				queue = []
			}
		})
	}

	#validateInput(logMessage){
        if(this.#closed)
            return false

		if(typeof logMessage !== 'string')
			return false
		
		if(logMessage.length === 0)
			return false

		return true
	}

	error(logMessage){
		if(!this.#validateInput(logMessage))
			return false

		this.#errorLogs.push(this.#makeLogMessage(logMessage))

        this.#errorLogsReady()

		return true
	}

	info(logMessage){
		if(!this.#validateInput(logMessage))
			return false
		
		this.#infoLogs.push(this.#makeLogMessage(logMessage))

        this.#infoLogsReady()
				
		return true
	}

	debug(logMessage){
		if(!(this.#validateInput(logMessage)))
			return false
		
		this.#debugLogs.push(this.#makeLogMessage(logMessage))

        this.#debugLogsReady()
				
		return true
	}

	#makeLogMessage(logMessage){
		return {
			timestamp: Date.now(),
			message:logMessage
		}
	}

    get errorLogs(){
        return this.#processLogs(structuredClone(this.#errorLogs))
    }

    get infoLogs(){
        return this.#processLogs(structuredClone(this.#infoLogs))
    }

    get debugLogs(){
        return this.#processLogs(structuredClone(this.#debugLogs))
    }

	//Strips the NULL at end of log
	#processLogs(logs){
		if(logs.length == 0)
			return logs
			
		if(logs.at(-1).message === null){
			logs.pop()
		}
		return logs
	}

    get errorStream(){
		return this.#errorStream
	}

	get infoStream(){
		return this.#infoStream
	}

	get debugStream(){
		return this.#debugStream
	}

	close(){
        if(!this.#closed){
            this.#errorLogs.push(this.#makeLogMessage(null))
            this.#errorLogsReady()
            this.#infoLogs.push(this.#makeLogMessage(null))
            this.#infoLogsReady()
            this.#debugLogs.push(this.#makeLogMessage(null))
            this.#debugLogsReady()
            this.#closed = true
        }
	}

    //Clear all. Instant close.
	destroy(){
		this.#errorStream.destroy()
		this.#infoStream.destroy()
		this.#debugStream.destroy()
    }

}

module.exports = Logger