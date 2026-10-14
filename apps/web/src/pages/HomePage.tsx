import { useEffect, useState, type SyntheticEvent } from 'react';
import { useNavigate } from 'react-router';
import { Alert } from '../components/Alert';
import { Button } from '../components/Button';
import { Lane } from '../components/Lane';
import { TextField } from '../components/TextField';
import { useAsyncAction } from '../hooks/use-async-action';
import { createRoom, joinRoom } from '../features/room/room-actions';
import { nicknameError } from '../lib/validation';
import { useNicknameStore } from '../stores/session-store';

const DEMO_LANES = [
  { nickname: 'Valentina', percent: 86 },
  { nickname: 'Mateo', percent: 63 },
  { nickname: 'Camila', percent: 74 },
];

/** Pista de muestra: los autos arrancan una sola vez al cargar la página. */
function DemoTrack() {
  const [started, setStarted] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => {
      setStarted(true);
    });
    return () => {
      cancelAnimationFrame(id);
    };
  }, []);
  return (
    <div aria-hidden="true" className="[&_li]:py-2 [&_.duration-300]:duration-[1600ms]">
      <ul className="divide-y divide-line">
        {DEMO_LANES.map((lane, index) => (
          <Lane
            key={lane.nickname}
            number={index + 1}
            nickname={lane.nickname}
            percent={started ? lane.percent : 0}
            isSelf={lane.nickname === 'Camila'}
          />
        ))}
      </ul>
    </div>
  );
}

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
    <div className="grid gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,26rem)] lg:gap-16">
      <section className="flex flex-col gap-6">
        <h1 className="font-display text-4xl leading-[1.05] sm:text-6xl">
          Escribe más rápido que tus amigos.
        </h1>
        <p className="max-w-prose text-lg text-muted">
          Crea una sala, comparte el código y compitan escribiendo el mismo texto. Todos ven el
          avance de los demás en tiempo real.
        </p>
        <DemoTrack />
      </section>

      <section aria-labelledby="jugar" className="flex flex-col gap-6 rounded-md bg-surface p-6">
        <h2 id="jugar" className="text-xl font-semibold">
          Entra a jugar
        </h2>

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
          <Button type="submit" pending={create.pending} className="w-full">
            Crear sala nueva
          </Button>
        </form>

        <div className="flex items-center gap-3 text-sm text-muted" aria-hidden="true">
          <span className="h-px flex-1 bg-line" /> o únete a una{' '}
          <span className="h-px flex-1 bg-line" />
        </div>

        <form onSubmit={(e) => void onJoin(e)} className="flex flex-col gap-3">
          <TextField
            label="Código de sala"
            placeholder="K7Q2XM"
            value={code}
            maxLength={6}
            autoCapitalize="characters"
            autoComplete="off"
            className="font-mono uppercase tracking-[0.3em]"
            onChange={(e) => {
              setCode(e.target.value.toUpperCase());
            }}
          />
          <Button type="submit" variant="secondary" pending={join.pending}>
            Unirme a la sala
          </Button>
        </form>
      </section>
    </div>
  );
}
