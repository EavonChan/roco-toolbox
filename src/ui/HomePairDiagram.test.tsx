import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, test } from 'vitest';
import type { HomePair, HomeResident, OwnedPet } from '../domain/types';
import { buildHomePairClusters, HomePairDiagram } from './HomePairDiagram';

afterEach(cleanup);

const resident = (over: Partial<HomeResident> & Pick<HomeResident, 'actorId' | 'name'>): HomeResident => ({
  instanceId: `ins_${over.actorId}`,
  baseId: '3001',
  furnitureGuid: `nest_${over.actorId}`,
  ...over,
});

const ACADEMY = resident({
  actorId: 'm1',
  name: '多西',
  gender: '公',
  nest: { furnitureGuid: 'nest_m1', configId: 1001072, nestType: 'academy', nestName: '学院小窝' },
});

describe('家园配窝图（摆位图画法）', () => {
  test('共享同一只精灵的两条配对并成一簇：绿块画一次、两条线连两只', () => {
    const residents = [
      resident({ actorId: 'f1', name: '火花', gender: '母' }),
      resident({ actorId: 'f2', name: '叮叮卯', gender: '母' }),
      ACADEMY,
    ];
    const couples: HomePair[] = [
      { femaleActorId: 'f1', maleActorIds: ['m1'] },
      { femaleActorId: 'f2', maleActorIds: ['m1'] },
    ];

    const clusters = buildHomePairClusters(couples, residents, new Map());
    expect(clusters).toHaveLength(1);
    expect(clusters[0].nodes.map((node) => node.name)).toEqual(['火花', '多西', '叮叮卯']);
    expect(clusters[0].edges).toEqual([
      [0, 1],
      [2, 1],
    ]);
    expect(clusters[0].nodes[1].academy).toBe(true);
  });

  test('互不相干的两对拆成两块，学院小窝那只绿底', () => {
    const residents = [
      resident({ actorId: 'f1', name: '火花', gender: '母' }),
      ACADEMY,
      resident({ actorId: 'f2', name: '冰钻布鲁', gender: '母' }),
      resident({ actorId: 'm2', name: '伊贝儿', gender: '公' }),
    ];
    const couples: HomePair[] = [
      { femaleActorId: 'f1', maleActorIds: ['m1'] },
      { femaleActorId: 'f2', maleActorIds: ['m2'] },
    ];

    render(<HomePairDiagram couples={couples} residents={residents} pets={new Map()} />);
    expect(screen.getByTestId('home-pair-diagram')).toBeTruthy();
    expect(screen.getAllByTestId('home-pair-node')).toHaveLength(4);

    const academyNode = screen
      .getAllByTestId('home-pair-node')
      .find((node) => node.getAttribute('data-name') === '多西');
    expect(academyNode?.getAttribute('data-academy')).toBe('true');
  });

  test('一对里母在左、公在右（和「配窝建议」的配对行、下面的家园精灵卡一致）', () => {
    const residents = [
      resident({ actorId: 'f1', name: '可立鸡', gender: '母' }),
      resident({ actorId: 'm1', name: '锤头鹅', gender: '公' }),
    ];

    render(
      <HomePairDiagram
        couples={[{ femaleActorId: 'f1', maleActorIds: ['m1'] }]}
        residents={residents}
        pets={new Map()}
      />,
    );

    const xOf = (name: string): number => {
      const node = screen
        .getAllByTestId('home-pair-node')
        .find((item) => item.getAttribute('data-name') === name);
      return Number(node?.querySelector('text')?.getAttribute('x'));
    };
    expect(xOf('可立鸡')).toBeLessThan(xOf('锤头鹅'));
  });

  test('配对里的公本不在快照里时，用虚线占位块写「公本未知」', () => {
    const residents = [resident({ actorId: 'f1', name: '火花', gender: '母' })];

    render(
      <HomePairDiagram
        couples={[{ femaleActorId: 'f1', maleActorIds: ['ghost'] }]}
        residents={residents}
        pets={new Map()}
      />,
    );

    const nodes = screen.getAllByTestId('home-pair-node');
    expect(nodes).toHaveLength(2);
    const missing = nodes.find((node) => node.getAttribute('data-name') === '公本未知');
    expect(missing?.getAttribute('data-missing')).toBe('true');
    expect(missing).toHaveTextContent('公本未知');
  });

  test('没有配对时不渲染画布', () => {
    render(<HomePairDiagram couples={[]} residents={[]} pets={new Map()} />);
    expect(screen.queryByTestId('home-pair-diagram')).toBeNull();
  });

  test('住户实例 id 对不上时，按同名唯一精灵兜底性别（不再显示未知）', () => {
    const female = resident({ actorId: 'f1', name: '兽花蕾', instanceId: 'new-id' });
    const male = resident({ actorId: 'm1', name: '恶魔叮', gender: '公' });
    const pets = new Map<string, OwnedPet>([
      [
        'old-id',
        {
          gameId: 3001,
          name: '兽花蕾',
          gender: '母',
          nature: '',
          voiceDb: 100,
          medalBody: '大块头',
          weightPercent: 90,
          heightPercent: 90,
          isShiny: false,
          account: 'A',
          captureId: 'cap_old-id',
        },
      ],
    ]);

    render(
      <HomePairDiagram
        couples={[{ femaleActorId: 'f1', maleActorIds: ['m1'] }]}
        residents={[female, male]}
        pets={pets}
      />,
    );

    const node = screen
      .getAllByTestId('home-pair-node')
      .find((item) => item.getAttribute('data-name') === '兽花蕾');
    expect(node).toHaveTextContent('♀');
  });
});
