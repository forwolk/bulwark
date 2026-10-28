import type { World } from '../core/World';
import type { MessageTone } from '../core/events';
import { clearBonus, earlyCallBonus } from '../systems/waveRewards';
import { el, setText } from './dom';

/** Top status bar, centre banner, message feed, ability cooldowns, hint line and launch button. */
export class Hud {
  private readonly root: HTMLElement;
  private readonly waveValue: HTMLElement;
  private readonly waveSub: HTMLElement;
  private readonly coreFill: HTMLElement;
  private readonly coreTrail: HTMLElement;
  private readonly coreText: HTMLElement;
  private readonly corePanel: HTMLElement;
  private readonly shieldFill: HTMLElement;
  private readonly shieldText: HTMLElement;
  private readonly scrapValue: HTMLElement;
  private readonly banner: HTMLElement;
  private readonly bannerSub: HTMLElement;
  private readonly bannerBox: HTMLElement;
  private readonly messages: HTMLElement;
  private readonly hint: HTMLElement;
  private readonly launch: HTMLButtonElement;
  private readonly missileTile: HTMLElement;
  private readonly novaTile: HTMLElement;
  private bannerTimer = 0;
  private displayedScrap = 0;
  private trailHp = 1;

  constructor(parent: HTMLElement, private readonly world: World, onLaunch: () => void) {
    this.root = el('div', 'hud', parent);

    const top = el('div', 'hud-top', this.root);
    const wave = el('div', 'panel stat', top);
    el('div', 'label', wave, 'Wave');
    this.waveValue = el('div', 'value', wave, '0 / 10');
    this.waveSub = el('div', 'sub', wave, 'Prepare defenses');

    this.corePanel = el('div', 'panel core', top);
    el('div', 'label', this.corePanel, 'Core integrity');
    const bar = el('div', 'bar', this.corePanel);
    this.coreTrail = el('div', 'bar-trail', bar);
    this.coreFill = el('div', 'bar-fill', bar);
    this.coreText = el('div', 'sub', this.corePanel, '');
    const shieldRow = el('div', 'shield-row', this.corePanel);
    const shieldBar = el('div', 'shield-bar', shieldRow);
    this.shieldFill = el('div', 'shield-fill', shieldBar);
    this.shieldText = el('div', 'shield-text', shieldRow, '');

    const scrap = el('div', 'panel stat scrap', top);
    el('div', 'label', scrap, 'Scrap');
    this.scrapValue = el('div', 'value', scrap, '0');

    this.bannerBox = el('div', 'banner', this.root);
    this.banner = el('div', 'banner-title', this.bannerBox);
    this.bannerSub = el('div', 'banner-sub', this.bannerBox);
    this.messages = el('div', 'messages', this.root);

    const abilities = el('div', 'abilities', this.root);
    this.missileTile = this.abilityTile(abilities, 'RMB', 'Swarm Missiles');
    el('div', 'ability-auto', this.missileTile, 'Auto');
    this.novaTile = this.abilityTile(abilities, 'SPACE', 'Nova Pulse');

    this.launch = el('button', 'launch', this.root);
    this.launch.addEventListener('click', () => onLaunch());
    this.hint = el('div', 'hint', this.root);

    const { events } = world;
    events.on('waveStarted', ({ wave, total }) => this.showBanner(wave === total ? 'Final wave' : `Wave ${wave}`, wave === total ? 'Something massive stirs' : 'Hostiles inbound', 'warn'));
    events.on('waveCleared', ({ wave, bonus }) => this.showBanner(`Wave ${wave} cleared`, `+${bonus} scrap · defenses repaired`, 'good'));
    events.on('message', ({ text, tone }) => this.pushMessage(text, tone));
    events.on('coreHealth', ({ hp, maxHp }) => {
      if (hp < maxHp && hp / maxHp < 0.3) this.corePanel.classList.add('critical');
      else this.corePanel.classList.remove('critical');
      this.corePanel.classList.remove('hit');
      void this.corePanel.offsetWidth;
      this.corePanel.classList.add('hit');
    });
  }

  private abilityTile(parent: HTMLElement, key: string, name: string): HTMLElement {
    const tile = el('div', 'ability', parent);
    el('div', 'ability-fill', tile);
    el('div', 'ability-key', tile, key);
    el('div', 'ability-name', tile, name);
    return tile;
  }

  showBanner(title: string, sub: string, tone: MessageTone): void {
    setText(this.banner, title);
    setText(this.bannerSub, sub);
    this.bannerBox.className = `banner show ${tone}`;
    this.bannerTimer = 2.6;
  }

  private pushMessage(text: string, tone: MessageTone): void {
    const msg = el('div', `message ${tone}`, this.messages, text);
    setTimeout(() => msg.classList.add('fade'), 2200);
    setTimeout(() => msg.remove(), 2800);
    while (this.messages.children.length > 4) this.messages.firstElementChild?.remove();
  }

  setVisible(visible: boolean): void {
    this.root.classList.toggle('hidden', !visible);
  }

  update(dt: number): void {
    const { world } = this;
    const { core, waves, economy, weapons, phase } = world;

    if (this.bannerTimer > 0) {
      this.bannerTimer -= dt;
      if (this.bannerTimer <= 0) this.bannerBox.classList.remove('show');
    }

    const waveNum = phase === 'combat' ? waves.index + 1 : Math.max(0, waves.index + 1);
    setText(this.waveValue, `${waveNum} / ${waves.total}`);
    if (phase === 'combat') {
      setText(this.waveSub, `${world.enemies.count + waves.remainingToSpawn} hostiles`);
    } else {
      setText(this.waveSub, 'Prepare defenses');
    }

    const hpFrac = core.hp / core.maxHp;
    this.trailHp = Math.max(hpFrac, this.trailHp - dt * 0.25);
    this.coreFill.style.width = `${hpFrac * 100}%`;
    this.coreTrail.style.width = `${this.trailHp * 100}%`;
    setText(this.coreText, `${Math.ceil(core.hp)} / ${core.maxHp}`);
    const shield = world.shields.core;
    this.shieldFill.style.width = `${(shield.hp / shield.maxHp) * 100}%`;
    this.shieldFill.classList.toggle('down', !shield.up);
    setText(this.shieldText, shield.up ? `Shield ${Math.ceil(shield.hp)} / ${shield.maxHp}` : 'Shield rebooting');

    // Count the scrap display toward the real value for a satisfying tick-up.
    const diff = economy.amount - this.displayedScrap;
    this.displayedScrap += Math.abs(diff) < 1 ? diff : diff * Math.min(1, dt * 10);
    setText(this.scrapValue, `${Math.round(this.displayedScrap)}`);

    this.updateAbility(this.missileTile, weapons.missileReady);
    this.missileTile.classList.toggle('auto', weapons.gun.autoFire);
    this.updateAbility(this.novaTile, weapons.novaReady);

    // Build phase: launch. Combat: call the next wave early for a bonus.
    const early = phase === 'combat' && waves.canCallEarly;
    const showLaunch = phase === 'build' || early;
    this.launch.classList.toggle('show', showLaunch);
    this.launch.classList.toggle('early', early);
    if (phase === 'build') setText(this.launch, `Launch wave ${waves.nextWaveNumber}  [Enter]`);
    else if (early) setText(this.launch, `Next wave ${waves.nextWaveNumber} ▸▸  +${clearBonus(waves.index + 1) + earlyCallBonus(waves.threats)}  [Enter]`);

    setText(this.hint, world.build.hint);
  }

  private updateAbility(tile: HTMLElement, ready: number): void {
    const fill = tile.firstElementChild as HTMLElement;
    fill.style.transform = `scaleY(${1 - ready})`;
    tile.classList.toggle('ready', ready >= 1);
  }
}
