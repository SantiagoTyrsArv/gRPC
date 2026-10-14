import { useState, type SyntheticEvent } from 'react';
import { useNavigate } from 'react-router';
import { Alert } from '../components/Alert';
import { Button } from '../components/Button';
import { TextField } from '../components/TextField';
import { DemoTower } from '../features/home/DemoTower';
import { useAsyncAction } from '../hooks/use-async-action';
import { createRoom, joinRoom } from '../features/room/room-actions';
import { nicknameError } from '../lib/validation';
import { useNicknameStore } from '../stores/session-store';

export function HomePage() {
  const navigate = useNavigate();
  const lastNickname = useNicknameStore((s) => s.lastNickname);
  const [nickname, setNickname] = useState(lastNickname);
  const [code, setCode] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const create = useAsyncAction(createRoom);
  const join = useAsyncAction(joinRoom);

  const validate = (): boolean => {
    const error = nicknameError(nickname);
    setFormError(error);
    return error === null;
  };

  const onCreate = async (e: SyntheticEvent) => {
    e.preventDefault();
    if (!validate()) return;
    const session = await create.run(nickname);
    if (session) void navigate(`/room/${session.roomCode}`);
  };

  const onJoin = async (e: SyntheticEvent) => {
    e.preventDefault();
    if (!validate()) return;
    if (code.trim().length !== 6) {
      setFormError('El código de sala tiene 6 caracteres.');
      return;
    }
    const session = await join.run(nickname, code);
    if (session) void navigate(`/room/${session.roomCode}`);
  };

  const error = formError ?? create.error ?? join.error;

  return (
    <div className="grid items-start gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,27rem)] lg:gap-16">
      <section aria-labelledby="titulo" className="flex max-w-xl flex-col gap-8">
        <div className="flex flex-col gap-4">
          <h1 id="titulo" className="font-display text-5xl leading-[0.95] sm:text-7xl">
            Escribe más rápido que tus amigos.
          </h1>
          <p className="max-w-prose text-lg text-muted">
            Crea una sala, comparte el código y escriban el mismo texto a la vez. La torre de
            tiempos muestra quién va adelante en cada momento.
          </p>
        </div>

        <div className="flex flex-col gap-5">
          <TextField
            label="Tu apodo"
            hint="Entre 2 y 20 caracteres. No necesitas registrarte."
            value={nickname}
            maxLength={20}
            autoComplete="nickname"
            onChange={(e) => {
              setNickname(e.target.value);
            }}
          />

          {error && <Alert>{error}</Alert>}

          <form onSubmit={(e) => void onCreate(e)}>
            <Button type="submit" pending={create.pending} className="min-h-13 w-full text-lg">
              Crear sala nueva
            </Button>
          </form>

          <form
            onSubmit={(e) => void onJoin(e)}
            aria-labelledby="unirse"
            className="flex flex-col gap-2 border-t border-line pt-5"
          >
            <p id="unirse" className="text-sm font-semibold">
              ¿Te pasaron un código? Únete a su sala
            </p>
            <div className="flex gap-2">
              <TextField
                label="Código de sala"
                hideLabel
                wrapperClassName="flex-1"
                placeholder="K7Q2XM"
                value={code}
                maxLength={6}
                autoCapitalize="characters"
                autoComplete="off"
                className="w-full font-mono text-lg uppercase tracking-[0.3em]"
                onChange={(e) => {
                  setCode(e.target.value.toUpperCase());
                }}
              />
              <Button type="submit" variant="secondary" pending={join.pending} className="shrink-0">
                Unirme
              </Button>
            </div>
          </form>
        </div>
      </section>

      <DemoTower />
    </div>
  );
}
