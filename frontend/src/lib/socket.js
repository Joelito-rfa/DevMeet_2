import { io } from 'socket.io-client';

export const socket = io({
  autoConnect: false,
  withCredentials: true,
  transports: ['websocket', 'polling'],
  reconnectionDelay: 500,
  reconnectionDelayMax: 4000,
});

/** Émet un événement avec accusé de réception, sous forme de promesse. */
export function emitAck(event, payload, timeout = 10000) {
  return new Promise((resolve, reject) => {
    socket.timeout(timeout).emit(event, payload, (err, res) => {
      if (err) return reject(new Error('Délai dépassé'));
      if (res?.error) return reject(new Error(res.error));
      resolve(res);
    });
  });
}
