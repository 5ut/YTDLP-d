const config = require("./systemConfig")
const sqlite = require('sqlite3')
const mysql = require('mysql')

let connection
let connected = false

const start = async ()=>{
    if(connected)
        return

    if(config.get("database-type") == "mysql"){
        return await startMysql()
    }else if(config.get("database-type") == "sqlite"){
        return await startSqlite()
    }else{
        throw new Error("Invalid database type")
    }
}

const startSqlite = ()=>{
    return new Promise((resolve, reject)=>{

        connection = new sqlite.Database(config.get("sqlite-file"), sqlite.OPEN_READWRITE | sqlite.OPEN_FULLMUTEX /*Wont create if doesn't exist*/, (err) => {
            if (err)
                return reject(err.stack)
            
            connected = true

            return resolve()
        })

    })
}

const startMysql = ()=>{
    return new Promise((resolve, reject)=>{

        connection = mysql.createConnection({
            host: config.get("mysql-db-host"),
            user: config.get("mysql-db-user"),
            password: config.get("mysql-db-pass"),
            database: config.get("mysql-db-db")
        })

        connection.connect((err)=>{
            if(err)
                return reject(err.stack)
    
            connected = true

            return resolve()
        })
    })
}

const stop = async ()=>{
    if(!connected)
        return

    if(config.get("database-type") == "mysql"){
        return await stopMysql()
    }else if(config.get("database-type") == "sqlite"){
        return await stopSqlite()
    }else{
        throw new Error("Invalid database type")
    }
}

const stopMysql = ()=>{
    return new Promise((resolve, reject)=>{
        connection.end(function(error) {
            connected = false 

            if(error)
                return reject(error)

            return resolve()
        })
    })
}

const stopSqlite = ()=>{
    return new Promise((resolve, reject)=>{
        connection.close(function(error) {
            connected = false

            if(error)
                return reject(error)

            return resolve()
        })
    })
}

// Wrapper for SQL queries, and redundent checks
const query = async (sql, params=[]) => {
    if(!connected)
        throw new Error("Not connected to a database")

    if(!Array.isArray(params))
        params = [params]

    sql = sql.trim()

    if(config.get("database-type") == "mysql"){
        return await queryMysql(sql, params)
    }else if(config.get("database-type") == "sqlite"){
        return await querySqlite(sql, params)
    }
}

const queryMysql = (sql, params)=>{
    return new Promise((resolve, reject)=>{
        connection.query(sql, params, (error, results)=>{
            if(error){
                if(error.code == "PROTOCOL_CONNECTION_LOST"){
                    connected = false
                }
                
                return reject("SQL Error: "+error.sqlMessage)
            }
                
            return resolve(results)
        })
    })
}

const querySqlite = (sql, params)=>{
    return new Promise(async (resolve, reject)=>{
        if(sql.toLowerCase().startsWith("select")){
            connection.all(sql, params, (error, results)=>{
                if(error)
                    return reject("SQL Error: "+error)
    
                return resolve(results)
            })
        }else{
            connection.run(sql, params, (error)=>{
                if(error)
                    return reject("SQL Error: "+error)
    
                return resolve()
            })
        }
    })
}

// Always resolves with connection status. Will not reject
const isConnected = async ()=>{
    if(!isConnected)
        return false

    if(config.get("database-type") == "mysql"){
        return await isConnectedMysql()
    }else if(config.get("database-type") == "sqlite"){
        return await isConnectedSqlite()
    }
}

// Nodejs Mysql does not have a callback for connection loss, instead we check by querying
// We will query for "SELECT 1", if any error occurs we know the DB isn't working.
// PROTOCOL_CONNECTION_LOST is disconnected
const isConnectedMysql = ()=>{
    return new Promise(async (resolve, reject)=>{
        connection.query("SELECT 1", [], (err, results)=>{
            if(err && err.code == "PROTOCOL_CONNECTION_LOST"){
                connected = false
                return resolve(false)
            }
 
            //Even if an error occured that is not "PROTOCOL_CONNECTION_LOST",
            //we know the connection is still active.
            return resolve(true)
        })
    })
}

// Nodejs SQLite does not have a method for checking connection.
// We will simply query with "SELCT 1", if it fails the DB isn't working.
// This shouldn't be required for SQLite as it's all local, but we use it for consistency
const isConnectedSqlite = ()=>{
    return new Promise(async (resolve, reject)=>{
        connection.get("SELECT 1", [], (err, results)=>{
            if(err){
                connected = false
                return resolve(false)
            }
 
            return resolve(true)
        })
    })
}

module.exports = {
    start: start,
    stop: stop,
    query: query,
    isConnected: isConnected
};