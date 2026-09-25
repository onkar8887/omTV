import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { io } from 'socket.io-client';
import useAuthStore from '../store/useAuthStore';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Mic, MicOff, Video, VideoOff, PhoneOff, 
  Send, Image as ImageIcon, ShieldAlert, Ban, 
  Trash2, Edit2, Check, X, AlertTriangle
} from 'lucide-react';
import ReportModal from '../components/Chat/ReportModal';

const ICE_SERVERS = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' }
  ]
};

export default function ChatRoom() {
  const user = useAuthStore((state) => state.user);
  const navigate = useNavigate();

  // Socket & WebRTC State
  const socketRef = useRef(null);
  const pcRef = useRef(null);
  const localStreamRef = useRef(null);
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const fileInputRef = useRef(null);
  const mediaReadyPromiseRef = useRef(null);
  const resolveMediaReadyRef = useRef(null);

  // UI State
  const [queueState, setQueueState] = useState('idle'); // idle, waiting, matched
  const [peerInfo, setPeerInfo] = useState(null); // { id, gender, country, state, mic: true, cam: true }
  const [messages, setMessages] = useState([]);
  const [chatInput, setChatInput] = useState('');
  const [editingMsgId, setEditingMsgId] = useState(null);
  
  // Media State
  const [micEnabled, setMicEnabled] = useState(true);
  const [camEnabled, setCamEnabled] = useState(true);
  
  // Modals
  const [showReport, setShowReport] = useState(false);
  const [showBlockConfirm, setShowBlockConfirm] = useState(false);
  const [toast, setToast] = useState(null); // { message, type }

  const showToast = (message, type = 'info') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  useEffect(() => {
    if (!user) {
      navigate('/login');
      return;
    }

    // Connect Socket
    const socketUrl = import.meta.env.VITE_SOCKET_URL || 'http://localhost:5000';
    socketRef.current = io(socketUrl, { withCredentials: true });
    const socket = socketRef.current;

    socket.on('connect', () => {
      console.log('Socket connected');
    });

    socket.on('matched', async (data) => {
      setQueueState('matched');
      setPeerInfo({ id: data.peerId, gender: data.peerGender, country: data.peerCountry, state: data.peerState, mic: true, cam: true });
      setMessages([]);
      
      // Initialize WebRTC
      initWebRTC(data.peerId, data.initiator);
    });

    socket.on('signal', async ({ from, data }) => {
      if (mediaReadyPromiseRef.current) {
        await mediaReadyPromiseRef.current;
      }
      const pc = pcRef.current;
      if (!pc) return;
      try {
        if (data.type === 'offer') {
          await pc.setRemoteDescription(new RTCSessionDescription(data));
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          socket.emit('signal', { to: from, data: answer });
        } else if (data.type === 'answer') {
          await pc.setRemoteDescription(new RTCSessionDescription(data));
        } else if (data.candidate) {
          await pc.addIceCandidate(new RTCIceCandidate(data));
        }
      } catch (err) {
        console.error('Signal error', err);
      }
    });

    socket.on('receive_message', ({ message }) => {
      setMessages(prev => [...prev, message]);
    });

    socket.on('message_edited', ({ messageId, content }) => {
      setMessages(prev => prev.map(m => m.id === messageId ? { ...m, content, edited: true } : m));
    });

    socket.on('message_deleted', ({ messageId }) => {
      setMessages(prev => prev.map(m => m.id === messageId ? { ...m, deleted: true } : m));
    });

    socket.on('receive_image', ({ image, messageId }) => {
      setMessages(prev => [...prev, { id: messageId, type: 'image', content: image, sender: 'peer', timestamp: new Date() }]);
    });

    socket.on('peer_camera_toggled', ({ enabled }) => {
      setPeerInfo(prev => prev ? { ...prev, cam: enabled } : prev);
    });

    socket.on('peer_mic_toggled', ({ enabled }) => {
      setPeerInfo(prev => prev ? { ...prev, mic: enabled } : prev);
    });

    socket.on('session_ended', ({ reason }) => {
      showToast('Stranger disconnected.', 'warning');
      cleanupSession();
    });

    // Screenshot Deterrents
    const handleVisibilityChange = () => {
      if (document.hidden && queueState === 'matched') {
        // Just log or show toast as deterrent
        console.log('Visibility lost - potential screen capture');
        showToast('Screenshots and recordings may violate community guidelines.', 'warning');
      }
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    // Prevent Context Menu (Right Click)
    const handleContextMenu = (e) => e.preventDefault();
    document.addEventListener('contextmenu', handleContextMenu);

    return () => {
      cleanupSession();
      socket.disconnect();
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      document.removeEventListener('contextmenu', handleContextMenu);
    };
  }, [user]);

  const initWebRTC = async (peerId, initiator) => {
    mediaReadyPromiseRef.current = new Promise(resolve => {
      resolveMediaReadyRef.current = resolve;
    });

    const pc = new RTCPeerConnection(ICE_SERVERS);
    pcRef.current = pc;

    pc.onicecandidate = (e) => {
      if (e.candidate) {
        socketRef.current.emit('signal', { to: peerId, data: e.candidate });
      }
    };

    pc.ontrack = (e) => {
      if (remoteVideoRef.current && e.streams[0]) {
        remoteVideoRef.current.srcObject = e.streams[0];
      }
    };

    // Get local media
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      localStreamRef.current = stream;
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }
      
      stream.getTracks().forEach(track => pc.addTrack(track, stream));

      // Sync initial state
      setCamEnabled(true);
      setMicEnabled(true);

      if (resolveMediaReadyRef.current) resolveMediaReadyRef.current();

      if (initiator) {
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        socketRef.current.emit('signal', { to: peerId, data: offer });
      }
    } catch (err) {
      console.error('Media access error', err);
      showToast('Could not access camera/microphone.', 'error');
      if (resolveMediaReadyRef.current) resolveMediaReadyRef.current();
    }
  };

  const cleanupSession = () => {
    if (pcRef.current) {
      pcRef.current.close();
      pcRef.current = null;
    }
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => track.stop());
      localStreamRef.current = null;
    }
    setQueueState('idle');
    setPeerInfo(null);
    setMessages([]);
  };

  const startMatchmaking = () => {
    setQueueState('waiting');
    socketRef.current.emit('join_queue', { userId: user._id });
  };

  const leaveQueue = () => {
    setQueueState('idle');
    socketRef.current.emit('leave_queue');
  };

  const endSession = () => {
    socketRef.current.emit('end_session');
    cleanupSession();
  };

  const toggleMic = () => {
    const stream = localStreamRef.current;
    if (stream) {
      const audioTrack = stream.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setMicEnabled(audioTrack.enabled);
        socketRef.current.emit('toggle_mic', { to: peerInfo.id, enabled: audioTrack.enabled });
      }
    }
  };

  const toggleCamera = () => {
    const stream = localStreamRef.current;
    if (stream) {
      const videoTrack = stream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setCamEnabled(videoTrack.enabled);
        socketRef.current.emit('toggle_camera', { to: peerInfo.id, enabled: videoTrack.enabled });
      }
    }
  };

  const handleSendMessage = (e) => {
    e.preventDefault();
    if (!chatInput.trim()) return;

    if (editingMsgId) {
      // Edit message
      socketRef.current.emit('edit_message', { to: peerInfo.id, messageId: editingMsgId, content: chatInput });
      setMessages(prev => prev.map(m => m.id === editingMsgId ? { ...m, content: chatInput, edited: true } : m));
      setEditingMsgId(null);
    } else {
      // Send new message
      const msg = {
        id: Date.now().toString(),
        type: 'text',
        content: chatInput,
        sender: 'me',
        timestamp: new Date()
      };
      setMessages(prev => [...prev, msg]);
      socketRef.current.emit('send_message', { to: peerInfo.id, message: { ...msg, sender: 'peer' } });
    }
    setChatInput('');
  };

  const deleteMessage = (id) => {
    socketRef.current.emit('delete_message', { to: peerInfo.id, messageId: id });
    setMessages(prev => prev.map(m => m.id === id ? { ...m, deleted: true } : m));
  };

  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      showToast('Image too large. Max 5MB.', 'error');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        // Compress using Canvas
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 800;
        const MAX_HEIGHT = 800;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > MAX_WIDTH) {
            height *= MAX_WIDTH / width;
            width = MAX_WIDTH;
          }
        } else {
          if (height > MAX_HEIGHT) {
            width *= MAX_HEIGHT / height;
            height = MAX_HEIGHT;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);
        
        // Quality 0.7 for jpeg
        const dataUrl = canvas.toDataURL('image/jpeg', 0.7);
        
        if (dataUrl.length > 1000000) { // ~1MB base64 size check
          showToast('Image still too large after compression.', 'error');
          return;
        }

        const msgId = Date.now().toString();
        setMessages(prev => [...prev, { id: msgId, type: 'image', content: dataUrl, sender: 'me', timestamp: new Date() }]);
        socketRef.current.emit('send_image', { to: peerInfo.id, image: dataUrl, messageId: msgId });
      };
      img.src = event.target.result;
    };
    reader.readAsDataURL(file);
    e.target.value = ''; // reset
  };

  const handleBlock = () => {
    socketRef.current.emit('block_user', { to: peerInfo.id, userId: user._id, peerUserId: peerInfo.userId || 'unknown' }); // Backend handles full ID lookup if needed via session, but we should pass it or backend infers. Wait, backend knows peer via socket.id
    // Actually backend handles finding the peerUserId from activeSessions
    // But since `userId` isn't sent to frontend for privacy, the backend should handle the block.
    // Let's just send a signal to backend and backend handles DB.
    socketRef.current.emit('block_user', { to: peerInfo.id });
    setShowBlockConfirm(false);
    cleanupSession();
    showToast('User blocked.', 'success');
  };

  const handleReport = (reason, description) => {
    // Backend needs to infer peerUserId from activeSessions
    socketRef.current.emit('report_user', { 
      to: peerInfo.id, 
      reporterId: user._id, 
      reason, 
      description 
    });
    cleanupSession();
    showToast('Report submitted and user blocked.', 'success');
  };

  // --- Render logic ---

  if (queueState === 'idle') {
    return (
      <div className="flex flex-col h-screen items-center justify-center bg-slate-950 text-white">
        <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="text-center">
          <div className="w-24 h-24 bg-indigo-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
            <Video className="text-indigo-400" size={40} />
          </div>
          <h1 className="text-4xl font-bold mb-4">Ready to chat?</h1>
          <p className="text-slate-400 mb-8">Meet interesting strangers instantly.</p>
          <button 
            onClick={startMatchmaking}
            className="px-8 py-4 bg-indigo-600 hover:bg-indigo-700 rounded-full font-bold text-lg shadow-[0_0_20px_rgba(79,70,229,0.4)] transition-all hover:scale-105"
          >
            Start Matchmaking
          </button>
        </motion.div>
      </div>
    );
  }

  if (queueState === 'waiting') {
    return (
      <div className="flex flex-col h-screen items-center justify-center bg-slate-950 text-white">
        <motion.div 
          animate={{ scale: [1, 1.1, 1] }} 
          transition={{ repeat: Infinity, duration: 2 }}
          className="w-24 h-24 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto mb-6"
        />
        <h2 className="text-2xl font-bold mb-2">Looking for someone...</h2>
        <p className="text-slate-400 mb-8">Please wait while we find a match.</p>
        <button 
          onClick={leaveQueue}
          className="px-6 py-2 bg-slate-800 hover:bg-slate-700 rounded-full text-sm font-medium transition-colors"
        >
          Cancel
        </button>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-slate-950 overflow-hidden select-none">
      
      {/* Toast */}
      <AnimatePresence>
        {toast && (
          <motion.div 
            initial={{ y: -50, opacity: 0 }}
            animate={{ y: 20, opacity: 1 }}
            exit={{ y: -50, opacity: 0 }}
            className={`fixed top-0 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-full font-medium shadow-lg flex items-center gap-2
              ${toast.type === 'error' ? 'bg-red-500 text-white' : 
                toast.type === 'warning' ? 'bg-amber-500 text-white' : 
                'bg-indigo-500 text-white'}`}
          >
            {toast.type === 'warning' && <AlertTriangle size={16} />}
            {toast.message}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Video Area */}
      <div className="flex-1 flex flex-col relative p-4 gap-4">
        
        {/* Header */}
        <div className="flex justify-between items-center bg-slate-900/50 backdrop-blur-md p-4 rounded-2xl border border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-indigo-500/20 rounded-full flex items-center justify-center">
              <span className="font-bold text-indigo-400">S</span>
            </div>
            <div>
              <h3 className="font-bold text-white">Stranger</h3>
              <p className="text-xs text-slate-400 capitalize">
                {peerInfo?.gender}
                {peerInfo?.country ? ` • ${peerInfo.country}` : ''}
                {peerInfo?.state ? ` • ${peerInfo.state}` : ''}
                 • Connected
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <button 
              onClick={() => setShowBlockConfirm(true)}
              className="p-2 text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors tooltip"
              title="Block User"
            >
              <Ban size={20} />
            </button>
            <button 
              onClick={() => setShowReport(true)}
              className="p-2 text-slate-400 hover:text-amber-400 hover:bg-amber-500/10 rounded-lg transition-colors tooltip"
              title="Report User"
            >
              <ShieldAlert size={20} />
            </button>
          </div>
        </div>

        {/* Videos Container */}
        <div className="flex-1 flex flex-col md:flex-row gap-4 relative min-h-0">
          
          {/* Remote Video */}
          <div className="flex-1 bg-slate-900 rounded-3xl overflow-hidden border border-slate-800 relative shadow-2xl group">
            <video 
              ref={remoteVideoRef} 
              autoPlay 
              playsInline 
              className={`w-full h-full object-cover transition-opacity duration-300 ${!peerInfo?.cam ? 'opacity-0' : 'opacity-100'}`} 
            />
            
            {/* Watermark */}
            <div className="absolute top-4 left-4 text-white/20 text-xs font-mono pointer-events-none select-none z-10">
              OmTV • {new Date().toLocaleTimeString()}
            </div>

            {/* Fallback avatar if cam off */}
            {!peerInfo?.cam && (
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <div className="w-24 h-24 bg-slate-800 rounded-full flex items-center justify-center mb-4">
                  <VideoOff size={32} className="text-slate-500" />
                </div>
                <p className="text-slate-400 font-medium">Camera is off</p>
              </div>
            )}
            
            {/* Mute indicator */}
            {!peerInfo?.mic && (
              <div className="absolute top-4 right-4 bg-red-500/80 p-2 rounded-full text-white backdrop-blur-sm z-10">
                <MicOff size={16} />
              </div>
            )}
          </div>

          {/* Local Video (Floating or Side-by-side) */}
          <div className="w-32 h-48 md:w-64 md:h-full bg-slate-800 rounded-2xl overflow-hidden border-2 border-indigo-500/30 absolute bottom-4 right-4 md:relative md:bottom-auto md:right-auto shadow-xl z-20">
            <video 
              ref={localVideoRef} 
              autoPlay 
              playsInline 
              muted 
              className={`w-full h-full object-cover transition-opacity duration-300 ${!camEnabled ? 'opacity-0' : 'opacity-100'} -scale-x-100`} 
            />
            {!camEnabled && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-800">
                <VideoOff size={24} className="text-slate-500" />
              </div>
            )}
          </div>
        </div>

        {/* Control Bar */}
        <div className="bg-slate-900/80 backdrop-blur-xl p-4 rounded-full border border-slate-700/50 flex justify-center items-center gap-6 shadow-2xl mx-auto z-30 mb-2">
          <button 
            onClick={toggleMic}
            className={`p-4 rounded-full transition-all ${micEnabled ? 'bg-slate-700 hover:bg-slate-600 text-white' : 'bg-red-500/20 text-red-500 hover:bg-red-500/30'}`}
          >
            {micEnabled ? <Mic size={24} /> : <MicOff size={24} />}
          </button>
          
          <button 
            onClick={toggleCamera}
            className={`p-4 rounded-full transition-all ${camEnabled ? 'bg-slate-700 hover:bg-slate-600 text-white' : 'bg-red-500/20 text-red-500 hover:bg-red-500/30'}`}
          >
            {camEnabled ? <Video size={24} /> : <VideoOff size={24} />}
          </button>
          
          <button 
            onClick={endSession}
            className="p-4 rounded-full bg-red-500 hover:bg-red-600 text-white shadow-[0_0_15px_rgba(239,68,68,0.4)] transition-all hover:scale-110 ml-4"
          >
            <PhoneOff size={24} />
          </button>
        </div>
      </div>

      {/* Chat Sidebar */}
      <div className="w-80 md:w-96 bg-slate-900 border-l border-slate-800 flex flex-col">
        {/* Messages Area */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          <div className="text-center text-xs text-slate-500 my-4">
            Connection secure. Messages are not saved.
          </div>
          
          <AnimatePresence>
            {messages.map((msg) => (
              <motion.div 
                key={msg.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className={`flex flex-col ${msg.sender === 'me' ? 'items-end' : 'items-start'}`}
              >
                {msg.deleted ? (
                  <div className="px-4 py-2 rounded-2xl bg-slate-800/50 text-slate-500 text-sm italic border border-slate-700/50">
                    This message was deleted
                  </div>
                ) : (
                  <div className="group relative">
                    <div className={`px-4 py-2.5 rounded-2xl max-w-[240px] break-words shadow-md ${
                      msg.sender === 'me' 
                        ? 'bg-indigo-600 text-white rounded-tr-sm' 
                        : 'bg-slate-800 text-slate-200 rounded-tl-sm border border-slate-700'
                    }`}>
                      {msg.type === 'text' ? (
                        <p>{msg.content}</p>
                      ) : (
                        <img src={msg.content} alt="shared" className="max-w-full rounded-lg pointer-events-none" draggable={false} />
                      )}
                      
                      {/* Meta info */}
                      <div className={`text-[10px] mt-1 flex items-center justify-end gap-1 ${msg.sender === 'me' ? 'text-indigo-200' : 'text-slate-500'}`}>
                        {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        {msg.edited && <span>(edited)</span>}
                      </div>
                    </div>
                    
                    {/* Hover Actions (Only for 'me' and text type) */}
                    {msg.sender === 'me' && msg.type === 'text' && (
                      <div className="absolute top-1/2 -translate-y-1/2 -left-16 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1 bg-slate-800 p-1 rounded-lg border border-slate-700">
                        <button onClick={() => { setEditingMsgId(msg.id); setChatInput(msg.content); }} className="p-1 text-slate-400 hover:text-indigo-400"><Edit2 size={14} /></button>
                        <button onClick={() => deleteMessage(msg.id)} className="p-1 text-slate-400 hover:text-red-400"><Trash2 size={14} /></button>
                      </div>
                    )}
                  </div>
                )}
              </motion.div>
            ))}
          </AnimatePresence>
        </div>

        {/* Input Area */}
        <div className="p-4 bg-slate-900 border-t border-slate-800">
          {editingMsgId && (
            <div className="flex justify-between items-center mb-2 px-2 text-sm text-indigo-400">
              <span>Editing message...</span>
              <button onClick={() => { setEditingMsgId(null); setChatInput(''); }}><X size={16} /></button>
            </div>
          )}
          <form onSubmit={handleSendMessage} className="flex gap-2">
            <button 
              type="button" 
              onClick={() => fileInputRef.current?.click()}
              className="p-3 bg-slate-800 hover:bg-slate-700 rounded-xl text-slate-400 transition-colors shrink-0"
            >
              <ImageIcon size={20} />
            </button>
            <input 
              type="file" 
              ref={fileInputRef} 
              className="hidden" 
              accept="image/*" 
              onChange={handleImageUpload} 
            />
            <input 
              type="text" 
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              placeholder="Type a message..."
              className="flex-1 bg-slate-800 border-none focus:ring-2 ring-indigo-500 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-500"
            />
            <button 
              type="submit"
              disabled={!chatInput.trim()}
              className="p-3 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:hover:bg-indigo-600 rounded-xl text-white transition-colors shrink-0 shadow-lg shadow-indigo-500/20"
            >
              <Send size={20} />
            </button>
          </form>
        </div>
      </div>

      {/* Modals */}
      <ReportModal 
        isOpen={showReport} 
        onClose={() => setShowReport(false)} 
        onSubmit={handleReport} 
      />

      {/* Block Confirm Modal */}
      <AnimatePresence>
        {showBlockConfirm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-slate-900 p-6 rounded-2xl border border-slate-800 shadow-2xl max-w-sm w-full text-center"
            >
              <div className="w-16 h-16 bg-red-500/20 text-red-500 rounded-full flex items-center justify-center mx-auto mb-4">
                <Ban size={32} />
              </div>
              <h2 className="text-xl font-bold mb-2">Block this user?</h2>
              <p className="text-slate-400 text-sm mb-6">
                You will immediately leave this chat and you won't be matched with them again.
              </p>
              <div className="flex gap-3">
                <button 
                  onClick={() => setShowBlockConfirm(false)}
                  className="flex-1 py-3 rounded-xl font-medium bg-slate-800 hover:bg-slate-700 transition-colors"
                >
                  Cancel
                </button>
                <button 
                  onClick={handleBlock}
                  className="flex-1 py-3 rounded-xl font-medium bg-red-600 hover:bg-red-700 text-white shadow-lg shadow-red-500/20 transition-colors"
                >
                  Block
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
