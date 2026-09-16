import { io } from 'socket.io-client'

let socket = null

export const getSocket = () => {
  if (!socket) {
    const token = localStorage.getItem('accessToken')
    socket = io('/', {
      auth: { token },
      transports: ['websocket', 'polling'],
      reconnectionAttempts: 5,
      reconnectionDelay: 1000
    })

    socket.on('connect', () => console.log('Socket connected:', socket.id))
    socket.on('disconnect', () => console.log('Socket disconnected'))
    socket.on('connect_error', (err) => console.error('Socket error:', err.message))
  }
  return socket
}

export const disconnectSocket = () => {
  if (socket) {
    socket.disconnect()
    socket = null
  }
}

export const subscribeToStock = (symbol, callback) => {
  const s = getSocket()
  s.emit('subscribe', symbol)
  s.on('quote', (data) => {
    if (data.symbol === symbol.toUpperCase()) callback(data)
  })
}

export const unsubscribeFromStock = (symbol) => {
  if (socket) socket.emit('unsubscribe', symbol)
}
