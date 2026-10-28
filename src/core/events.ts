import type * as THREE from 'three';
import type { CoreWeaponId } from '../config/coreWeapons';
import type { EnemyKind } from '../config/enemies';
import type { SquadKind } from '../config/squads';
import type { StructureKind } from '../config/structures';
import type { UpgradeId } from '../config/upgrades';

export type Phase = 'title' | 'build' | 'combat' | 'victory' | 'defeat';

export type MessageTone = 'info' | 'warn' | 'good';

export type GameEvents = {
  scrap: { amount: number; delta: number };
  phase: { phase: Phase; wave: number };
  coreHealth: { hp: number; maxHp: number };
  waveStarted: { wave: number; total: number };
  waveCleared: { wave: number; bonus: number };
  enemyKilled: { kind: EnemyKind; reward: number; position: THREE.Vector3 };
  structureBuilt: { kind: StructureKind };
  structureLost: { kind: StructureKind };
  buildSelection: { kind: StructureKind | null };
  upgradePurchased: { id: UpgradeId; level: number };
  squadDeployed: { kind: SquadKind };
  coreWeapon: { id: CoreWeaponId; switching: boolean };
  squadLost: { kind: SquadKind };
  message: { text: string; tone: MessageTone };
};
