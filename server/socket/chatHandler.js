const User = require('../models/User');
const Report = require('../models/Report');
const { v4: uuidv4 } = require('uuid');

let waitingUsers = []; // [{ socket, userId, gender, blockedUsers }]
let activeSessions = new Map(); // sessionId -> { p1: { socket, userId, ... }, p2: { ... } }
let socketSessions = new Map(); // socket.id -> sessionId

module.exports = (io) => {
  io.on('connection', (socket) => {
    // console.log(`User connected: ${socket.id}`);

    // Join Matchmaking Queue
    socket.on('join_queue', async ({ userId }) => {
      try {
        const user = await User.findById(userId).select('gender blockedUsers country state');
        if (!user) return socket.emit('queue_error', 'User not found');

        // Check if user is already in queue
        if (waitingUsers.find(u => u.userId.toString() === userId)) {
          return; // Already waiting
        }

        const blockedUsersStrs = user.blockedUsers.map(id => id.toString());

        // Try to find a match
        let matchIndex = -1;
        for (let i = 0; i < waitingUsers.length; i++) {
          const potentialMatch = waitingUsers[i];
          // Check block list (mutual)
          if (!blockedUsersStrs.includes(potentialMatch.userId.toString()) &&
              !potentialMatch.blockedUsers.includes(userId)) {
            matchIndex = i;
            break;
          }
        }

        if (matchIndex !== -1) {
          // Found a match
          const peer = waitingUsers.splice(matchIndex, 1)[0];
          const sessionId = uuidv4();

          activeSessions.set(sessionId, {
            p1: { socket: socket, userId, gender: user.gender, country: user.country, state: user.state },
            p2: { socket: peer.socket, userId: peer.userId, gender: peer.gender, country: peer.country, state: peer.state }
          });
          socketSessions.set(socket.id, sessionId);
          socketSessions.set(peer.socket.id, sessionId);

          // Emit matched event to both
          socket.emit('matched', { 
            sessionId, 
            peerId: peer.socket.id, 
            peerGender: peer.gender, 
            peerCountry: peer.country,
            peerState: peer.state,
            initiator: true // p1 initiates WebRTC offer
          });
          peer.socket.emit('matched', { 
            sessionId, 
            peerId: socket.id, 
            peerGender: user.gender, 
            peerCountry: user.country,
            peerState: user.state,
            initiator: false 
          });
        } else {
          // No match, join queue
          waitingUsers.push({
            socket,
            userId: userId,
            gender: user.gender,
            country: user.country,
            state: user.state,
            blockedUsers: blockedUsersStrs
          });
        }
      } catch (error) {
        console.error('Queue error:', error);
      }
    });

    socket.on('leave_queue', () => {
      waitingUsers = waitingUsers.filter(u => u.socket.id !== socket.id);
    });

    // WebRTC Signaling
    socket.on('signal', ({ to, data }) => {
      socket.to(to).emit('signal', { from: socket.id, data });
    });

    // Chat Events
    socket.on('send_message', ({ to, message }) => {
      socket.to(to).emit('receive_message', { from: socket.id, message });
    });

    socket.on('edit_message', ({ to, messageId, content }) => {
      socket.to(to).emit('message_edited', { messageId, content });
    });

    socket.on('delete_message', ({ to, messageId }) => {
      socket.to(to).emit('message_deleted', { messageId });
    });

    socket.on('send_image', ({ to, image, messageId }) => {
      socket.to(to).emit('receive_image', { from: socket.id, image, messageId });
    });

    // Media Controls
    socket.on('toggle_camera', ({ to, enabled }) => {
      socket.to(to).emit('peer_camera_toggled', { enabled });
    });

    socket.on('toggle_mic', ({ to, enabled }) => {
      socket.to(to).emit('peer_mic_toggled', { enabled });
    });

    // Safety / Session Management
    socket.on('end_session', () => {
      handleEndSession(socket.id);
    });

    socket.on('block_user', async ({ to, userId }) => {
      try {
        const sessionId = socketSessions.get(socket.id);
        if (!sessionId) return;
        const session = activeSessions.get(sessionId);
        if (!session) return;
        
        // Find the peer's DB userId
        const peerUserId = session.p1.socket.id === socket.id ? session.p2.userId : session.p1.userId;
        
        await User.findByIdAndUpdate(userId, { $addToSet: { blockedUsers: peerUserId } });
        socket.to(to).emit('session_ended', { reason: 'Peer disconnected' }); 
        handleEndSession(socket.id);
      } catch (error) {
        console.error('Block error:', error);
      }
    });

    socket.on('report_user', async ({ to, reporterId, reason, description }) => {
      try {
        const sessionId = socketSessions.get(socket.id);
        if (!sessionId) return;
        const session = activeSessions.get(sessionId);
        if (!session) return;
        
        const reportedUserId = session.p1.socket.id === socket.id ? session.p2.userId : session.p1.userId;

        await Report.create({
          reporterId,
          reportedUserId,
          reason,
          description,
          chatSessionId: sessionId
        });
        // Auto block
        await User.findByIdAndUpdate(reporterId, { $addToSet: { blockedUsers: reportedUserId } });
        
        socket.to(to).emit('session_ended', { reason: 'Peer disconnected' });
        handleEndSession(socket.id);
      } catch (error) {
        console.error('Report error:', error);
      }
    });

    socket.on('disconnect', () => {
      waitingUsers = waitingUsers.filter(u => u.socket.id !== socket.id);
      handleEndSession(socket.id);
    });

    function handleEndSession(socketId) {
      const sessionId = socketSessions.get(socketId);
      if (sessionId) {
        const session = activeSessions.get(sessionId);
        if (session) {
          const peer = session.p1.socket.id === socketId ? session.p2.socket : session.p1.socket;
          peer.emit('session_ended', { reason: 'Peer disconnected' });
          socketSessions.delete(peer.id);
        }
        activeSessions.delete(sessionId);
        socketSessions.delete(socketId);
      }
    }
  });
};
