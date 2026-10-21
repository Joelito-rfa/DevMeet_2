let ioInstance = null;

export const setIo = (io) => {
  ioInstance = io;
};
export const getIo = () => ioInstance;

export const roomChannel = (roomId) => `room:${roomId}`;
export const boardChannel = (roomId) => `board:${roomId}`;
export const voiceChannel = (roomId) => `voice:${roomId}`;
export const userChannel = (userId) => `user:${userId}`;
