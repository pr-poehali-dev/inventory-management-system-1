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

const GAME_WIDTH = 1200;
const GAME_HEIGHT = 800;
const PLAYER_SIZE = 20;
const PLAYER_SPEED = 3;

const Index = () => {
  const gameRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameLoopRef = useRef<number>();
  const [keys, setKeys] = useState<Set<string>>(new Set());
  const [gameState, setGameState] = useState<'menu' | 'playing'>('menu');
  
  const [player, setPlayer] = useState<Player>({
    x: 400,
    y: 300,
    inventory: [
      { id: 'wood', name: 'Дерево', icon: '🪵', quantity: 3, maxStack: 50, rarity: 'common' },
      { id: 'iron', name: 'Железо', icon: '🔧', quantity: 2, maxStack: 100, rarity: 'common' }
    ],
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

  const [gameMode, setGameMode] = useState<'playing' | 'inventory' | 'warehouse' | 'crafting'>('playing');
  const [craftingOpen, setCraftingOpen] = useState(false);
  const [selectedWarehouse, setSelectedWarehouse] = useState<string>('');

  // Генерация мира
  const generateWorld = () => {
    const newDrops = [];
    for (let i = 0; i < 15; i++) {
      newDrops.push({
        id: `drop-${i}`,
        itemId: Math.random() > 0.5 ? 'wood' : 'iron',
        x: 50 + Math.random() * (GAME_WIDTH - 100),
        y: 50 + Math.random() * (GAME_HEIGHT - 100),
        quantity: 1 + Math.floor(Math.random() * 3),
        collected: false
      });
    }
    setItemDrops(newDrops);
  };

  // 3D рендеринг
  const render3D = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Очистка экрана
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Фон неба
    const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
    gradient.addColorStop(0, '#87CEEB');
    gradient.addColorStop(0.7, '#98FB98');
    gradient.addColorStop(1, '#90EE90');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Изометрическая проекция
    const project3D = (x: number, y: number, z: number = 0) => {
      const isoX = (x - y) * 0.8;
      const isoY = (x + y) * 0.4 - z * 0.6;
      return { 
        x: canvas.width / 2 + isoX - (player.x - player.y) * 0.8,
        y: canvas.height / 2 + isoY - (player.x + player.y) * 0.4
      };
    };

    // Рендеринг складов как 3D блоки
    warehouses.forEach(warehouse => {
      const pos = project3D(warehouse.x, warehouse.y, 0);
      const topPos = project3D(warehouse.x, warehouse.y, 30);
      
      // Тень
      ctx.fillStyle = 'rgba(0,0,0,0.2)';
      ctx.fillRect(pos.x - 30, pos.y + 10, 60, 20);
      
      // Основание
      ctx.fillStyle = getWarehouseColor(warehouse.type);
      ctx.fillRect(pos.x - 25, pos.y - 10, 50, 40);
      
      // Верх (3D эффект)
      ctx.fillStyle = '#ffffff40';
      ctx.fillRect(pos.x - 20, topPos.y - 5, 40, 30);
      
      // Иконка
      ctx.fillStyle = 'white';
      ctx.font = '16px Arial';
      ctx.textAlign = 'center';
      const icon = warehouse.type === 'storage' ? '📦' : 
                   warehouse.type === 'production' ? '🏭' : '🔨';
      ctx.fillText(icon, pos.x, pos.y + 5);
    });

    // Рендеринг предметов
    itemDrops.filter(drop => !drop.collected).forEach(drop => {
      const pos = project3D(drop.x, drop.y, 5);
      
      // Блеск предмета
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, 8, 0, Math.PI * 2);
      ctx.fillStyle = '#FFD700';
      ctx.fill();
      ctx.strokeStyle = '#FFA500';
      ctx.lineWidth = 2;
      ctx.stroke();
      
      // Иконка предмета
      ctx.fillStyle = 'white';
      ctx.font = '12px Arial';
      ctx.textAlign = 'center';
      ctx.fillText(getItemData(drop.itemId)?.icon || '?', pos.x, pos.y + 3);
    });

    // Рендеринг игрока как 3D персонаж
    const playerPos = project3D(player.x, player.y, 0);
    
    // Тень игрока
    ctx.beginPath();
    ctx.ellipse(playerPos.x, playerPos.y + 15, 8, 4, 0, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.fill();
    
    // Тело игрока
    ctx.beginPath();
    ctx.arc(playerPos.x, playerPos.y, 12, 0, Math.PI * 2);
    ctx.fillStyle = '#FF6B35';
    ctx.fill();
    ctx.strokeStyle = '#E55100';
    ctx.lineWidth = 2;
    ctx.stroke();
    
    // Лицо
    ctx.fillStyle = 'white';
    ctx.fillRect(playerPos.x - 3, playerPos.y - 4, 2, 2);
    ctx.fillRect(playerPos.x + 1, playerPos.y - 4, 2, 2);
    ctx.fillStyle = 'black';
    ctx.fillRect(playerPos.x - 3, playerPos.y + 1, 6, 1);

    // UI поверх 3D
    renderUI(ctx);
  }, [player, warehouses, itemDrops]);

  // Рендеринг UI
  const renderUI = (ctx: CanvasRenderingContext2D) => {
    const canvas = canvasRef.current!;
    
    // Здоровье
    ctx.fillStyle = 'rgba(0,0,0,0.7)';
    ctx.fillRect(10, 10, 200, 25);
    ctx.fillStyle = '#FF4444';
    ctx.fillRect(12, 12, (player.health / player.maxHealth) * 196, 21);
    ctx.fillStyle = 'white';
    ctx.font = '12px Arial';
    ctx.textAlign = 'left';
    ctx.fillText(`HP: ${player.health}/${player.maxHealth}`, 15, 27);

    // Опыт
    ctx.fillStyle = 'rgba(0,0,0,0.7)';
    ctx.fillRect(10, 40, 200, 20);
    ctx.fillStyle = '#4CAF50';
    const expProgress = (player.experience % 100) / 100;
    ctx.fillRect(12, 42, expProgress * 196, 16);
    ctx.fillStyle = 'white';
    ctx.fillText(`Уровень ${player.level} | Опыт: ${player.experience}`, 15, 54);

    // Быстрый инвентарь
    const slotSize = 40;
    const startX = canvas.width / 2 - (4 * slotSize) / 2;
    const startY = canvas.height - 60;
    
    for (let i = 0; i < 4; i++) {
      const x = startX + i * slotSize;
      const item = player.inventory[i];
      
      ctx.fillStyle = 'rgba(0,0,0,0.8)';
      ctx.fillRect(x, startY, slotSize - 4, slotSize - 4);
      ctx.strokeStyle = 'white';
      ctx.lineWidth = 1;
      ctx.strokeRect(x, startY, slotSize - 4, slotSize - 4);
      
      if (item) {
        ctx.fillStyle = 'white';
        ctx.font = '18px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(item.icon, x + slotSize/2, startY + 22);
        ctx.font = '10px Arial';
        ctx.fillText(item.quantity.toString(), x + slotSize - 10, startY + slotSize - 8);
      }
    }

    // Подсказки
    ctx.fillStyle = 'rgba(0,0,0,0.7)';
    ctx.fillRect(canvas.width - 150, 10, 140, 70);
    ctx.fillStyle = 'white';
    ctx.font = '11px Arial';
    ctx.textAlign = 'left';
    ctx.fillText('WASD - движение', canvas.width - 145, 25);
    ctx.fillText('E - взаимодействие', canvas.width - 145, 40);
    ctx.fillText('C - крафтинг', canvas.width - 145, 55);
    ctx.fillText('I - инвентарь', canvas.width - 145, 70);
  };

  // Система управления
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (gameState !== 'playing') return;
      
      const key = e.key.toLowerCase();
      setKeys(prev => new Set(prev).add(key));
      
      // Быстрые клавиши
      if (key === 'i') setGameMode('inventory');
      if (key === 'c') setCraftingOpen(true);
      if (key === 'escape') setGameState('menu');
      if (key === 'e') {
        // Сбор предметов рядом
        const nearDrop = itemDrops.find(drop => 
          !drop.collected &&
          Math.abs(player.x - drop.x) < 40 && 
          Math.abs(player.y - drop.y) < 40
        );
        if (nearDrop) {
          collectItem(nearDrop);
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
  }, [gameState, player, itemDrops]);

  // Игровой цикл
  useEffect(() => {
    if (gameState !== 'playing') return;

    const gameLoop = () => {
      // Обновление движения
      if (keys.size > 0) {
        setPlayer(prev => {
          let newX = prev.x;
          let newY = prev.y;

          if (keys.has('w')) newY -= PLAYER_SPEED;
          if (keys.has('s')) newY += PLAYER_SPEED;
          if (keys.has('a')) newX -= PLAYER_SPEED;
          if (keys.has('d')) newX += PLAYER_SPEED;

          // Границы
          newX = Math.max(30, Math.min(GAME_WIDTH - 30, newX));
          newY = Math.max(30, Math.min(GAME_HEIGHT - 30, newY));

          // Автосбор предметов
          itemDrops.forEach(drop => {
            if (!drop.collected && 
                Math.abs(newX - drop.x) < 25 && 
                Math.abs(newY - drop.y) < 25) {
              collectItem(drop);
            }
          });

          return { ...prev, x: newX, y: newY };
        });
      }
      
      // Рендеринг
      render3D();
      
      gameLoopRef.current = requestAnimationFrame(gameLoop);
    };

    gameLoopRef.current = requestAnimationFrame(gameLoop);

    return () => {
      if (gameLoopRef.current) {
        cancelAnimationFrame(gameLoopRef.current);
      }
    };
  }, [gameState, keys, render3D]);

  // Сбор предметов
  const collectItem = (drop: ItemDrop) => {
    setItemDrops(prev => 
      prev.map(d => d.id === drop.id ? { ...d, collected: true } : d)
    );
    
    setPlayer(prev => {
      const newInventory = [...prev.inventory];
      const existingItem = newInventory.find(item => item.id === drop.itemId);
      
      if (existingItem) {
        existingItem.quantity += drop.quantity;
      } else if (newInventory.length < prev.maxInventorySlots) {
        const itemData = getItemData(drop.itemId);
        if (itemData) {
          newInventory.push({ ...itemData, quantity: drop.quantity });
        }
      }
      
      return { 
        ...prev, 
        inventory: newInventory,
        experience: prev.experience + 5
      };
    });
    
    toast.success(`+${drop.quantity} ${getItemData(drop.itemId)?.name}`);
  };

  // Крафтинг рецепты
  const recipes = [
    {
      id: 'wooden-sword',
      name: 'Деревянный меч',
      ingredients: [{ itemId: 'wood', quantity: 3 }, { itemId: 'iron', quantity: 1 }],
      output: { itemId: 'wooden-sword', quantity: 1 }
    },
    {
      id: 'wooden-pickaxe', 
      name: 'Деревянная кирка',
      ingredients: [{ itemId: 'wood', quantity: 2 }, { itemId: 'iron', quantity: 2 }],
      output: { itemId: 'wooden-pickaxe', quantity: 1 }
    }
  ];

  // Функция крафтинга
  const craft = (recipeId: string) => {
    const recipe = recipes.find(r => r.id === recipeId);
    if (!recipe) return;

    // Проверка ресурсов
    const canCraft = recipe.ingredients.every(ing => {
      const item = player.inventory.find(i => i.id === ing.itemId);
      return item && item.quantity >= ing.quantity;
    });

    if (!canCraft) {
      toast.error('Недостаточно ресурсов!');
      return;
    }

    setPlayer(prev => {
      const newInventory = [...prev.inventory];
      
      // Убираем ресурсы
      recipe.ingredients.forEach(ing => {
        const item = newInventory.find(i => i.id === ing.itemId);
        if (item) {
          item.quantity -= ing.quantity;
          if (item.quantity <= 0) {
            const index = newInventory.indexOf(item);
            newInventory.splice(index, 1);
          }
        }
      });
      
      // Добавляем результат
      const outputData = {
        id: recipe.output.itemId,
        name: recipe.name,
        icon: recipe.output.itemId === 'wooden-sword' ? '⚔️' : '⛏️',
        quantity: recipe.output.quantity,
        maxStack: 1,
        rarity: 'rare' as const
      };
      
      newInventory.push(outputData);
      
      return {
        ...prev,
        inventory: newInventory,
        experience: prev.experience + 20
      };
    });
    
    toast.success(`Создано: ${recipe.name}!`);
    setCraftingOpen(false);
  };

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

  // Главное меню
  if (gameState === 'menu') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white flex items-center justify-center">
        <div className="text-center space-y-8">
          <div className="space-y-4">
            <h1 className="text-6xl font-bold bg-gradient-to-r from-orange-400 to-blue-400 bg-clip-text text-transparent" style={{ fontFamily: 'Orbitron, monospace' }}>
              3D КРАФТ ИГРА
            </h1>
            <p className="text-xl text-slate-300">Исследуй 3D мир, собирай ресурсы, создавай предметы!</p>
          </div>
          
          <div className="space-y-4">
            <Button 
              onClick={() => {
                setGameState('playing');
                generateWorld();
              }}
              className="bg-gradient-to-r from-orange-600 to-orange-500 hover:from-orange-700 hover:to-orange-600 text-white px-8 py-4 text-xl font-bold"
              size="lg"
            >
              <Icon name="Play" size={24} className="mr-3" />
              ИГРАТЬ
            </Button>
            
            <div className="grid grid-cols-2 gap-4 max-w-md mx-auto">
              <Button variant="outline" className="border-slate-600 text-white hover:bg-slate-800">
                <Icon name="Settings" size={16} className="mr-2" />
                Настройки
              </Button>
              
              <Button variant="outline" className="border-slate-600 text-white hover:bg-slate-800">
                <Icon name="Info" size={16} className="mr-2" />
                О игре
              </Button>
            </div>
          </div>
          
          <div className="text-sm text-slate-400 space-y-2">
            <p>🎮 WASD - движение в 3D мире</p>
            <p>⚡ E - взаимодействие/сбор</p>
            <p>🔨 C - открыть крафтинг</p>
            <p>🎒 I - инвентарь</p>
          </div>
        </div>
      </div>
    );
  }

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
              Назад в игру
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

  // Основная игра с 3D canvas
  return (
    <div className="min-h-screen bg-black">
      <canvas 
        ref={canvasRef}
        width={1200}
        height={800}
        className="w-full h-screen cursor-crosshair"
        style={{ imageRendering: 'pixelated' }}
      />
      
      {/* Модальные окна */}
      {craftingOpen && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
          <Card className="bg-slate-800 border-slate-700 w-96 max-w-full">
            <CardHeader>
              <CardTitle className="text-white flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <Icon name="Hammer" size={20} className="text-orange-400" />
                  Крафтинг
                </span>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => setCraftingOpen(false)}
                  className="text-white hover:bg-slate-700"
                >
                  <Icon name="X" size={16} />
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {recipes.map(recipe => (
                <div key={recipe.id} className="p-3 bg-slate-700 rounded-lg">
                  <h4 className="font-medium text-white mb-2">{recipe.name}</h4>
                  
                  <div className="text-sm text-slate-300 mb-3">
                    Требуется: {recipe.ingredients.map(ing => 
                      `${ing.quantity} ${getItemData(ing.itemId)?.name}`
                    ).join(', ')}
                  </div>
                  
                  <Button 
                    onClick={() => craft(recipe.id)}
                    className="w-full bg-blue-600 hover:bg-blue-700"
                    disabled={!recipe.ingredients.every(ing => {
                      const item = player.inventory.find(i => i.id === ing.itemId);
                      return item && item.quantity >= ing.quantity;
                    })}
                  >
                    <Icon name="Plus" size={14} className="mr-2" />
                    Создать
                  </Button>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
};

export default Index;