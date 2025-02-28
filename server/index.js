//criar o servidor websocket para comunicacao bi-lateral cliente-servidor 
//criar um servidor http, importando http
const http = require('http')
//criar um websocket importando o modulo ws
const {WebSocketServer} = require('ws')
const url = require('url')
const uuid = require('uuid').v4



const server = http.createServer()
const wsServer = new WebSocketServer({ server })
const port = 8000

const connections = { }
const users = { }

const broadcastUsers = () => {
    Object.keys(connections).forEach(uuid => {
        const connection = connections[uuid]
        connection.send(message)
    })
}


const handleMessage = (bytes, uuid) => {
    const message = JSON.parse(bytes.toString())
    const user = users[uuid]
    user.state = message

    broadcastUsers()
}

const handleClose = uuid => {
    delete connections[uuid]
    delete users[uuid]

    broadcast()
}



wsServer.on("connection", (connection, request) =>{
    const { username } = url.parse(request.url, true).query
    const uuid = uuidv4()
    console.log(username)
    console.log(uuid)

    connections[uuid] = connection
    
    connection.username = 

    users[uuid] = {
        username,
        state: { }
    }

    connection.on("message", message => handleMessage(message, uuid))
    connection.on("close", () => handleClose(uuid))
    
})

server.listen(port, () => {
    console.log('Websocket server rodando na porta ' + port)

} )