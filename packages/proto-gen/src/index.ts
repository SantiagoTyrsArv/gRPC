// Punto de entrada del paquete: re-exporta los mensajes y servicios generados.
// El directorio `gen/` no se versiona; se regenera con `pnpm generate`.
export * from './gen/typerace/v1/common_pb.js';
export * from './gen/typerace/v1/room_pb.js';
export * from './gen/typerace/v1/race_pb.js';
export * from './gen/typerace/v1/leaderboard_pb.js';
