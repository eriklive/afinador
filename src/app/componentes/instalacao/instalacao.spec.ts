import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { PainelInstalacao } from './instalacao';
import { Atualizacao } from '../../nucleo/atualizacao';
import { Instalacao } from '../../nucleo/instalacao';

/** Instalação sob controle do teste: aqui não há convite de navegador nenhum. */
const instalacao = {
  temConvite: signal(false),
  disponivel: signal(false),
  instalar: vi.fn(async () => true),
};

const atualizacao = {
  pronta: signal(false),
  aplicar: vi.fn(async () => undefined),
};

async function montar() {
  const fixture = TestBed.createComponent(PainelInstalacao);
  await fixture.whenStable();
  return fixture;
}

describe('PainelInstalacao', () => {
  beforeEach(async () => {
    instalacao.temConvite.set(false);
    instalacao.disponivel.set(false);
    instalacao.instalar.mockClear();
    atualizacao.pronta.set(false);
    atualizacao.aplicar.mockClear();

    await TestBed.configureTestingModule({
      imports: [PainelInstalacao],
      providers: [
        { provide: Instalacao, useValue: instalacao as unknown as Instalacao },
        { provide: Atualizacao, useValue: atualizacao as unknown as Atualizacao },
      ],
    }).compileComponents();
  });

  it('não mostra nada quando não há o que instalar nem o que atualizar', async () => {
    const elemento = (await montar()).nativeElement as HTMLElement;

    expect(elemento.querySelector('.instalar')).toBeNull();
    expect(elemento.querySelector('.atualizar')).toBeNull();
  });

  it('mostra o convite do navegador ao toque, sem abrir instruções', async () => {
    instalacao.disponivel.set(true);
    instalacao.temConvite.set(true);
    const fixture = await montar();
    const elemento = fixture.nativeElement as HTMLElement;

    elemento.querySelector<HTMLButtonElement>('.instalar')!.click();
    await fixture.whenStable();

    expect(instalacao.instalar).toHaveBeenCalledOnce();
    expect(elemento.querySelector('.instalar__ajuda')).toBeNull();
  });

  it('sem convite — o caso do iOS — o toque abre o caminho do menu Compartilhar', async () => {
    instalacao.disponivel.set(true);
    const fixture = await montar();
    const elemento = fixture.nativeElement as HTMLElement;

    elemento.querySelector<HTMLButtonElement>('.instalar')!.click();
    await fixture.whenStable();

    expect(instalacao.instalar).not.toHaveBeenCalled();
    expect(elemento.querySelector('.instalar__ajuda')?.textContent).toContain(
      'Adicionar à Tela de Início',
    );
  });

  it('fecha as instruções ao segundo toque', async () => {
    instalacao.disponivel.set(true);
    const fixture = await montar();
    const elemento = fixture.nativeElement as HTMLElement;
    const botao = elemento.querySelector<HTMLButtonElement>('.instalar')!;

    botao.click();
    await fixture.whenStable();
    botao.click();
    await fixture.whenStable();

    expect(elemento.querySelector('.instalar__ajuda')).toBeNull();
  });

  it('avisa da versão nova e troca de versão ao toque', async () => {
    atualizacao.pronta.set(true);
    const fixture = await montar();
    const elemento = fixture.nativeElement as HTMLElement;

    const aviso = elemento.querySelector<HTMLButtonElement>('.atualizar');
    expect(aviso?.textContent).toContain('Nova versão');

    aviso!.click();
    expect(atualizacao.aplicar).toHaveBeenCalledOnce();
  });
});
