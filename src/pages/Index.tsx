import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import Icon from '@/components/ui/icon';
import { toast } from 'sonner';

interface Item {
  id: string;
  name: string;
  icon: string;
  quantity: number;
  maxStack: number;
  rarity: 'common' | 'rare' | 'epic' | 'legendary';
}

interface Player {
  x: number;
  y: number;
  inventory: Item[];
  maxInventorySlots: number;
  health: number;
  maxHealth: number;
  experience: number;
  level: number;
}

interface ItemDrop {
  id: string;
  itemId: string;
  x: number;
  y: number;
  quantity: number;
  collected: boolean;
}

interface Warehouse {
  id: string;
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
  capacity: number;
  used: number;
  items: Item[];
  type: 'storage' | 'production' | 'crafting';
}

const GAME_WIDTH = 800;
const GAME_HEIGHT = 600;
const PLAYER_SIZE = 20;
const PLAYER_SPEED = 3;

const Index = () => {
  const gameRef = useRef<HTMLDivElement>(null);
  const [keys, setKeys] = useState<Set<string>>(new Set());
  
  const [player, setPlayer] = useState<Player>({
    x: 100,
    y: 100,
    inventory: [],
    maxInventorySlots: 12,
    health: 100,
    maxHealth: 100,
    experience: 0,
    level: 1
  });

  const [warehouses] = useState<Warehouse[]>([
    {
      id: '1',
      name: 'Главный склад',
      x: 200,
      y: 150,
      width: 120,
      height: 80,
      capacity: 1000,
      used: 450,
      type: 'storage',
      items: [
        { id: 'iron', name: 'Железо', icon: '🔧', quantity: 150, maxStack: 100, rarity: 'common' },
        { id: 'wood', name: 'Дерево', icon: '🪵', quantity: 200, maxStack: 50, rarity: 'common' }
      ]
    },
    {
      id: '2',
      name: 'Цех производства',
      x: 450,
      y: 200,
      width: 100,
      height: 60,
      capacity: 500,
      used: 120,
      type: 'production',
      items: []
    },
    {
      id: '3',
      name: 'Крафт-станция',
      x: 350,
      y: 350,
      width: 80,
      height: 80,
      capacity: 200,
      used: 50,
      type: 'crafting',
      items: []
    }
  ]);

  const [itemDrops, setItemDrops] = useState<ItemDrop[]>([
    { id: '1', itemId: 'iron', x: 300, y: 100, quantity: 5, collected: false },
    { id: '2', itemId: 'wood', x: 150, y: 200, quantity: 3, collected: false },
    { id: '3', itemId: 'crystal', x: 500, y: 300, quantity: 1, collected: false }
  ]);

  const [gameMode, setGameMode] = useState<'playing' | 'inventory' | 'warehouse'>('playing');
  const [selectedWarehouse, setSelectedWarehouse] = useState<string>('');

  // Система управления
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      setKeys(prev => new Set(prev).add(e.key.toLowerCase()));
      
      // Быстрые клавиши
      if (e.key.toLowerCase() === 'i') {
        setGameMode(prev => prev === 'inventory' ? 'playing' : 'inventory');
      }
      if (e.key.toLowerCase() === 'e') {
        // Проверяем близость к складу
        const nearWarehouse = warehouses.find(w => 
          Math.abs(player.x - (w.x + w.width/2)) < 50 && 
          Math.abs(player.y - (w.y + w.height/2)) < 50
        );
        if (nearWarehouse) {
          setSelectedWarehouse(nearWarehouse.id);
          setGameMode('warehouse');
        }
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      setKeys(prev => {
        const newKeys = new Set(prev);
        newKeys.delete(e.key.toLowerCase());
        return newKeys;
      });
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [player, warehouses]);

  // Игровой цикл движения
  useEffect(() => {
    const gameLoop = setInterval(() => {
      if (gameMode !== 'playing') return;

      setPlayer(prev => {
        let newX = prev.x;
        let newY = prev.y;

        if (keys.has('w') || keys.has('arrowup')) newY -= PLAYER_SPEED;
        if (keys.has('s') || keys.has('arrowdown')) newY += PLAYER_SPEED;
        if (keys.has('a') || keys.has('arrowleft')) newX -= PLAYER_SPEED;
        if (keys.has('d') || keys.has('arrowright')) newX += PLAYER_SPEED;

        // Границы игрового поля
        newX = Math.max(PLAYER_SIZE/2, Math.min(GAME_WIDTH - PLAYER_SIZE/2, newX));
        newY = Math.max(PLAYER_SIZE/2, Math.min(GAME_HEIGHT - PLAYER_SIZE/2, newY));

        // Коллизия со складами
        const colliding = warehouses.some(w => 
          newX - PLAYER_SIZE/2 < w.x + w.width &&
          newX + PLAYER_SIZE/2 > w.x &&
          newY - PLAYER_SIZE/2 < w.y + w.height &&
          newY + PLAYER_SIZE/2 > w.y
        );

        if (colliding) {
          return prev;
        }

        return { ...prev, x: newX, y: newY };
      });
    }, 16); // ~60 FPS

    return () => clearInterval(gameLoop);
  }, [keys, gameMode, warehouses]);

  // Сбор предметов
  useEffect(() => {
    const checkItemCollection = () => {
      setItemDrops(prev => {
        const newDrops = [...prev];
        let collected = false;

        newDrops.forEach(drop => {
          if (!drop.collected) {
            const distance = Math.sqrt(
              Math.pow(player.x - drop.x, 2) + Math.pow(player.y - drop.y, 2)
            );

            if (distance < 30) {
              drop.collected = true;
              collected = true;

              // Добавляем в инвентарь
              setPlayer(prevPlayer => {
                const newInventory = [...prevPlayer.inventory];
                const existingItem = newInventory.find(item => item.id === drop.itemId);

                if (existingItem) {
                  existingItem.quantity += drop.quantity;
                } else if (newInventory.length < prevPlayer.maxInventorySlots) {
                  const itemData = getItemData(drop.itemId);
                  if (itemData) {
                    newInventory.push({
                      ...itemData,
                      quantity: drop.quantity
                    });
                  }
                }

                return {
                  ...prevPlayer,
                  inventory: newInventory,
                  experience: prevPlayer.experience + 10
                };
              });

              toast.success(`Собрано: ${drop.quantity} ${getItemData(drop.itemId)?.name || drop.itemId}`);
            }
          }
        });

        return newDrops;
      });
    };

    if (gameMode === 'playing') {
      const interval = setInterval(checkItemCollection, 100);
      return () => clearInterval(interval);
    }
  }, [player.x, player.y, gameMode]);

  const getItemData = (itemId: string): Omit<Item, 'quantity'> | null => {
    const itemsData: { [key: string]: Omit<Item, 'quantity'> } = {
      iron: { id: 'iron', name: 'Железо', icon: '🔧', maxStack: 100, rarity: 'common' },
      wood: { id: 'wood', name: 'Дерево', icon: '🪵', maxStack: 50, rarity: 'common' },
      crystal: { id: 'crystal', name: 'Кристалл', icon: '💎', maxStack: 10, rarity: 'epic' },
      gear: { id: 'gear', name: 'Шестеренка', icon: '⚙️', maxStack: 20, rarity: 'rare' }
    };
    return itemsData[itemId] || null;
  };

  const getRarityColor = (rarity: string) => {
    switch (rarity) {
      case 'common': return 'bg-gray-100 text-gray-800 border-gray-300';
      case 'rare': return 'bg-blue-100 text-blue-800 border-blue-300';
      case 'epic': return 'bg-purple-100 text-purple-800 border-purple-300';
      case 'legendary': return 'bg-orange-100 text-orange-800 border-orange-300';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getWarehouseColor = (type: string) => {
    switch (type) {
      case 'storage': return '#FF6B35';
      case 'production': return '#4A90E2';
      case 'crafting': return '#9B59B6';
      default: return '#6C7B7F';
    }
  };

  if (gameMode === 'inventory') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white p-6">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-3xl font-bold" style={{ fontFamily: 'Orbitron, monospace' }}>
              Инвентарь игрока
            </h1>
            <Button onClick={() => setGameMode('playing')} className="bg-orange-600 hover:bg-orange-700">
              <Icon name="ArrowLeft" size={16} className="mr-2" />
              Вернуться в игру
            </Button>
          </div>

          {/* Статистика игрока */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <Card className="bg-slate-800 border-slate-700">
              <CardContent className="pt-6">
                <div className="text-center">
                  <div className="text-2xl mb-2">👤</div>
                  <div className="text-sm text-slate-400">Уровень</div>
                  <div className="text-xl font-bold text-white">{player.level}</div>
                </div>
              </CardContent>
            </Card>
            
            <Card className="bg-slate-800 border-slate-700">
              <CardContent className="pt-6">
                <div className="text-center">
                  <div className="text-2xl mb-2">❤️</div>
                  <div className="text-sm text-slate-400">Здоровье</div>
                  <Progress value={(player.health / player.maxHealth) * 100} className="mt-2" />
                </div>
              </CardContent>
            </Card>
            
            <Card className="bg-slate-800 border-slate-700">
              <CardContent className="pt-6">
                <div className="text-center">
                  <div className="text-2xl mb-2">⭐</div>
                  <div className="text-sm text-slate-400">Опыт</div>
                  <div className="text-xl font-bold text-white">{player.experience}</div>
                </div>
              </CardContent>
            </Card>
            
            <Card className="bg-slate-800 border-slate-700">
              <CardContent className="pt-6">
                <div className="text-center">
                  <div className="text-2xl mb-2">🎒</div>
                  <div className="text-sm text-slate-400">Слоты</div>
                  <div className="text-xl font-bold text-white">
                    {player.inventory.length}/{player.maxInventorySlots}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Инвентарь */}
          <Card className="bg-slate-800 border-slate-700">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <Icon name="Package" size={20} className="text-orange-400" />
                Предметы в инвентаре
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-6 gap-3">
                {Array.from({ length: player.maxInventorySlots }, (_, index) => {
                  const item = player.inventory[index];
                  return (
                    <div
                      key={index}
                      className={`aspect-square border-2 border-dashed border-slate-600 rounded-lg flex flex-col items-center justify-center p-2 ${
                        item ? `${getRarityColor(item.rarity)} border-solid` : 'bg-slate-700'
                      }`}
                    >
                      {item ? (
                        <>
                          <div className="text-2xl mb-1">{item.icon}</div>
                          <div className="text-xs font-medium text-center">{item.name}</div>
                          <div className="text-xs font-bold">{item.quantity}</div>
                        </>
                      ) : (
                        <div className="text-slate-500 text-xs">Пусто</div>
                      )}
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (gameMode === 'warehouse') {
    const warehouse = warehouses.find(w => w.id === selectedWarehouse);
    if (!warehouse) {
      setGameMode('playing');
      return null;
    }

    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white p-6">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-3xl font-bold" style={{ fontFamily: 'Orbitron, monospace' }}>
              {warehouse.name}
            </h1>
            <Button onClick={() => setGameMode('playing')} className="bg-orange-600 hover:bg-orange-700">
              <Icon name="ArrowLeft" size={16} className="mr-2" />
              Закрыть склад
            </Button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Содержимое склада */}
            <Card className="bg-slate-800 border-slate-700">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  <Icon name="Warehouse" size={20} className="text-orange-400" />
                  Содержимое склада
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {warehouse.items.map((item) => (
                    <div key={item.id} className="flex items-center justify-between p-3 bg-slate-700 rounded-lg">
                      <div className="flex items-center gap-3">
                        <span className="text-2xl">{item.icon}</span>
                        <div>
                          <div className="font-medium text-white">{item.name}</div>
                          <div className="text-sm text-slate-400">Количество: {item.quantity}</div>
                        </div>
                      </div>
                      <Badge className={getRarityColor(item.rarity)}>
                        {item.rarity}
                      </Badge>
                    </div>
                  ))}
                  
                  {warehouse.items.length === 0 && (
                    <div className="text-center text-slate-400 py-8">
                      <Icon name="Package" size={48} className="mx-auto mb-4" />
                      <p>Склад пуст</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Инвентарь игрока для обмена */}
            <Card className="bg-slate-800 border-slate-700">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  <Icon name="User" size={20} className="text-blue-400" />
                  Ваш инвентарь
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {player.inventory.map((item, index) => (
                    <div key={index} className="flex items-center justify-between p-3 bg-slate-700 rounded-lg">
                      <div className="flex items-center gap-3">
                        <span className="text-2xl">{item.icon}</span>
                        <div>
                          <div className="font-medium text-white">{item.name}</div>
                          <div className="text-sm text-slate-400">Количество: {item.quantity}</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge className={getRarityColor(item.rarity)}>
                          {item.rarity}
                        </Badge>
                        <Button size="sm" className="bg-green-600 hover:bg-green-700">
                          <Icon name="ArrowUp" size={14} />
                        </Button>
                      </div>
                    </div>
                  ))}
                  
                  {player.inventory.length === 0 && (
                    <div className="text-center text-slate-400 py-8">
                      <Icon name="Package" size={48} className="mx-auto mb-4" />
                      <p>Инвентарь пуст</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white">
      {/* Заголовок */}
      <div className="bg-gradient-to-r from-orange-600 to-blue-600 p-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <h1 className="text-3xl font-bold" style={{ fontFamily: 'Orbitron, monospace' }}>
            3D Складской Симулятор
          </h1>
          <div className="flex items-center gap-4">
            <Badge className="bg-white/20 text-white">
              Уровень {player.level}
            </Badge>
            <Badge className="bg-white/20 text-white">
              Опыт: {player.experience}
            </Badge>
          </div>
        </div>
      </div>

      <div className="p-6">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            {/* Игровое поле */}
            <div className="lg:col-span-3">
              <Card className="bg-slate-800 border-slate-700">
                <CardHeader>
                  <CardTitle className="text-white flex items-center gap-2">
                    <Icon name="Gamepad2" size={20} className="text-orange-400" />
                    Игровое поле
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div 
                    ref={gameRef}
                    className="relative border-2 border-slate-600 rounded-lg overflow-hidden bg-gradient-to-br from-slate-700 to-slate-600"
                    style={{ width: GAME_WIDTH, height: GAME_HEIGHT, margin: '0 auto' }}
                    tabIndex={0}
                  >
                    {/* Склады */}
                    {warehouses.map((warehouse) => (
                      <div
                        key={warehouse.id}
                        className="absolute border-2 border-dashed rounded-lg flex items-center justify-center text-white font-bold"
                        style={{
                          left: warehouse.x,
                          top: warehouse.y,
                          width: warehouse.width,
                          height: warehouse.height,
                          backgroundColor: getWarehouseColor(warehouse.type) + '40',
                          borderColor: getWarehouseColor(warehouse.type)
                        }}
                      >
                        <div className="text-center">
                          <div className="text-xs">{warehouse.name}</div>
                          <div className="text-xs opacity-75">
                            {warehouse.type === 'storage' && '📦'}
                            {warehouse.type === 'production' && '🏭'}
                            {warehouse.type === 'crafting' && '🔨'}
                          </div>
                        </div>
                      </div>
                    ))}

                    {/* Предметы на земле */}
                    {itemDrops.filter(drop => !drop.collected).map((drop) => (
                      <div
                        key={drop.id}
                        className="absolute w-6 h-6 flex items-center justify-center rounded-full bg-yellow-400 border-2 border-yellow-600 animate-pulse"
                        style={{
                          left: drop.x - 12,
                          top: drop.y - 12
                        }}
                      >
                        <span className="text-xs">
                          {getItemData(drop.itemId)?.icon || '?'}
                        </span>
                      </div>
                    ))}

                    {/* Игрок */}
                    <div
                      className="absolute bg-orange-500 border-2 border-orange-600 rounded-full flex items-center justify-center text-white font-bold transition-all duration-75"
                      style={{
                        left: player.x - PLAYER_SIZE/2,
                        top: player.y - PLAYER_SIZE/2,
                        width: PLAYER_SIZE,
                        height: PLAYER_SIZE
                      }}
                    >
                      👤
                    </div>
                  </div>

                  {/* Управление */}
                  <div className="mt-4 text-center text-sm text-slate-400">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                      <div>WASD / Стрелки - движение</div>
                      <div>I - инвентарь</div>
                      <div>E - склад (рядом)</div>
                      <div>Собирайте предметы!</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Боковая панель */}
            <div className="space-y-6">
              {/* Статус игрока */}
              <Card className="bg-slate-800 border-slate-700">
                <CardHeader>
                  <CardTitle className="text-white text-sm">Статус</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-slate-400">Здоровье</span>
                      <span className="text-white">{player.health}/{player.maxHealth}</span>
                    </div>
                    <Progress value={(player.health / player.maxHealth) * 100} />
                  </div>
                  
                  <div>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-slate-400">Инвентарь</span>
                      <span className="text-white">{player.inventory.length}/{player.maxInventorySlots}</span>
                    </div>
                    <Progress value={(player.inventory.length / player.maxInventorySlots) * 100} />
                  </div>
                  
                  <div className="pt-2">
                    <Button 
                      onClick={() => setGameMode('inventory')} 
                      className="w-full bg-blue-600 hover:bg-blue-700"
                    >
                      <Icon name="Package" size={14} className="mr-2" />
                      Открыть инвентарь
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* Быстрый инвентарь */}
              <Card className="bg-slate-800 border-slate-700">
                <CardHeader>
                  <CardTitle className="text-white text-sm">Быстрые слоты</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-3 gap-2">
                    {Array.from({ length: 6 }, (_, index) => {
                      const item = player.inventory[index];
                      return (
                        <div
                          key={index}
                          className={`aspect-square border border-slate-600 rounded flex flex-col items-center justify-center text-xs ${
                            item ? 'bg-slate-700' : 'bg-slate-800'
                          }`}
                        >
                          {item ? (
                            <>
                              <div className="text-lg">{item.icon}</div>
                              <div className="text-xs font-bold">{item.quantity}</div>
                            </>
                          ) : (
                            <div className="text-slate-500">—</div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>

              {/* Задания */}
              <Card className="bg-slate-800 border-slate-700">
                <CardHeader>
                  <CardTitle className="text-white text-sm">Задания</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="p-2 bg-slate-700 rounded text-xs">
                    <div className="font-medium text-white">Сбор ресурсов</div>
                    <div className="text-slate-400">Соберите 10 железа</div>
                    <div className="text-yellow-400">{player.inventory.find(i => i.id === 'iron')?.quantity || 0}/10</div>
                  </div>
                  
                  <div className="p-2 bg-slate-700 rounded text-xs">
                    <div className="font-medium text-white">Исследователь</div>
                    <div className="text-slate-400">Посетите все склады</div>
                    <div className="text-yellow-400">0/3</div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Index;