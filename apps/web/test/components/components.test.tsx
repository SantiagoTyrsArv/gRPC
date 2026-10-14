import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import type { PlayerResult } from '../../src/api/types';
import { Countdown } from '../../src/features/race/Countdown';
import { TypingArea } from '../../src/features/race/TypingArea';
import { useTypingEngine } from '../../src/features/race/use-typing-engine';
import { ResultsPodium } from '../../src/features/results/ResultsPodium';

function TypingHarness({ text, enabled = true }: { text: string; enabled?: boolean }) {
  const engine = useTypingEngine(text, enabled);
  return (
    <>
      <TypingArea engine={engine} enabled={enabled} />
      <output data-testid="position">{engine.state.position}</output>
    </>
  );
}

describe('TypingArea', () => {
  it('avanza al escribir y marca el error hasta borrarlo', async () => {
    const user = userEvent.setup();
    render(<TypingHarness text="hola" />);
    const input = screen.getByLabelText('Escribe aquí el texto de la carrera');
    expect(input).toHaveFocus();

    await user.type(input, 'hx');
    expect(screen.getByTestId('position')).toHaveTextContent('1');
    expect(screen.getByText(/Corrige el error/)).toBeInTheDocument();

    await user.keyboard('{Backspace}ola');
    expect(screen.getByTestId('position')).toHaveTextContent('4');
    expect(screen.queryByText(/Corrige el error/)).not.toBeInTheDocument();
  });

  it('bloquea pegar texto', () => {
    render(<TypingHarness text="hola" />);
    const input = screen.getByLabelText('Escribe aquí el texto de la carrera');
    const pasteEvent = new Event('paste', { bubbles: true, cancelable: true });
    fireEvent(input, pasteEvent);
    expect(pasteEvent.defaultPrevented).toBe(true);
    expect(screen.getByTestId('position')).toHaveTextContent('0');
  });

  it('está deshabilitada antes de la salida', () => {
    render(<TypingHarness text="hola" enabled={false} />);
    expect(screen.getByLabelText('Escribe aquí el texto de la carrera')).toBeDisabled();
  });

  it('expone el texto completo a lectores de pantalla', () => {
    render(<TypingHarness text="hola mundo" />);
    expect(screen.getByText('Texto de la carrera: hola mundo')).toBeInTheDocument();
  });
});

describe('Countdown', () => {
  it('anuncia los segundos restantes con aria-live', () => {
    const { rerender } = render(<Countdown remainingMs={2_300} />);
    const live = screen.getByText('3');
    expect(live).toHaveAttribute('aria-live', 'assertive');
    rerender(<Countdown remainingMs={0} />);
    expect(screen.getByText('¡Ya!')).toBeInTheDocument();
  });
});

describe('ResultsPodium', () => {
  const results: PlayerResult[] = [
    {
      playerId: 'b',
      nickname: 'Beto',
      position: 1,
      wpm: 72.4,
      accuracy: 0.97,
      elapsedMs: 41_000,
      finished: true,
    },
    {
      playerId: 'a',
      nickname: 'Ana',
      position: 2,
      wpm: 65,
      accuracy: 0.92,
      elapsedMs: 46_500,
      finished: true,
    },
    {
      playerId: 'c',
      nickname: 'Caro',
      position: 3,
      wpm: 30,
      accuracy: 0.8,
      elapsedMs: 0,
      finished: false,
    },
  ];

  it('muestra el podio y la tabla de resultados', () => {
    render(<ResultsPodium results={results} selfId="a" />);
    expect(screen.getByRole('list', { name: 'Podio' })).toBeInTheDocument();
    expect(screen.getByLabelText('Posición 1')).toBeInTheDocument();

    const rows = screen.getAllByRole('row');
    expect(rows).toHaveLength(4); // encabezado + 3
    expect(rows[1]).toHaveTextContent('Beto');
    expect(rows[1]).toHaveTextContent('72 ppm');
    expect(rows[1]).toHaveTextContent('41.0 s');
    expect(rows[3]).toHaveTextContent('No terminó');
  });
});
