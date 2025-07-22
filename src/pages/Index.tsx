import React, { useState, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import Icon from '@/components/ui/icon';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { toast } from 'sonner';

interface Item {
  id: string;
  name: string;
  icon: string;
  quantity: number;
  maxStack: number;
  rarity: 'common' | 'rare' | 'epic' | 'legendary';
}

interface Warehouse {
  id: string;
  name: string;
  capacity: number;
  used: number;
  items: Item[];
  type: 'storage' | 'production' | 'logistics';
}

interface Recipe {
  id: string;
  name: string;
  ingredients: { itemId: string; quantity: number }[];
  output: { itemId: string; quantity: number };
  craftingTime: number;
}

const Index = () => {
  const [warehouses, setWarehouses] = useState<Warehouse[]>([
    {
      id: '1',
      name: 'Главный склад',
      capacity: 1000,
      used: 450,
      type: 'storage',
      items: [
        { id: 'iron', name: 'Железо', icon: '🔩', quantity: 150, maxStack: 100, rarity: 'common' },
        { id: 'wood', name: 'Дерево', icon: '🪵', quantity: 200, maxStack: 50, rarity: 'common' },
        { id: 'crystal', name: 'Кристалл', icon: '💎', quantity: 10, maxStack: 10, rarity: 'epic' }
      ]
    },
    {
      id: '2',
      name: 'Производственный цех',
      capacity: 500,
      used: 120,
      type: 'production',
      items: [
        { id: 'gear', name: 'Шестеренка', icon: '⚙️', quantity: 25, maxStack: 20, rarity: 'rare' },
        { id: 'cable', name: 'Кабель', icon: '🔌', quantity: 45, maxStack: 30, rarity: 'common' }
      ]
    },
    {
      id: '3',
      name: 'Логистический центр',
      capacity: 800,
      used: 200,
      type: 'logistics',
      items: [
        { id: 'container', name: 'Контейнер', icon: '📦', quantity: 30, maxStack: 25, rarity: 'common' }
      ]
    }
  ]);

  const [recipes] = useState<Recipe[]>([
    {
      id: 'gear-recipe',
      name: 'Шестеренка',
      ingredients: [{ itemId: 'iron', quantity: 3 }, { itemId: 'wood', quantity: 1 }],
      output: { itemId: 'gear', quantity: 1 },
      craftingTime: 30
    },
    {
      id: 'cable-recipe',
      name: 'Кабель',
      ingredients: [{ itemId: 'iron', quantity: 2 }],
      output: { itemId: 'cable', quantity: 2 },
      craftingTime: 15
    },
    {
      id: 'container-recipe',
      name: 'Контейнер',
      ingredients: [{ itemId: 'iron', quantity: 5 }, { itemId: 'wood', quantity: 3 }],
      output: { itemId: 'container', quantity: 1 },
      craftingTime: 45
    }
  ]);

  const [selectedWarehouse, setSelectedWarehouse] = useState<string>('');
  const [craftingQueue, setCraftingQueue] = useState<{ recipeId: string; startTime: number }[]>([]);

  // Защищенная функция перемещения предметов
  const moveItem = useCallback((fromWarehouseId: string, toWarehouseId: string, itemId: string, quantity: number) => {
    setWarehouses(prev => {
      const newWarehouses = [...prev];
      const fromWarehouse = newWarehouses.find(w => w.id === fromWarehouseId);
      const toWarehouse = newWarehouses.find(w => w.id === toWarehouseId);
      
      if (!fromWarehouse || !toWarehouse) {
        toast.error('Склад не найден');
        return prev;
      }

      const item = fromWarehouse.items.find(i => i.id === itemId);
      if (!item || item.quantity < quantity) {
        toast.error('Недостаточно предметов');
        return prev;
      }

      if (toWarehouse.used + quantity > toWarehouse.capacity) {
        toast.error('Недостаточно места на складе');
        return prev;
      }

      // Безопасное перемещение
      item.quantity -= quantity;
      if (item.quantity === 0) {
        fromWarehouse.items = fromWarehouse.items.filter(i => i.id !== itemId);
      }
      fromWarehouse.used -= quantity;

      const existingItem = toWarehouse.items.find(i => i.id === itemId);
      if (existingItem) {
        existingItem.quantity += quantity;
      } else {
        toWarehouse.items.push({ ...item, quantity });
      }
      toWarehouse.used += quantity;

      toast.success(`Перемещено: ${quantity} ${item.name}`);
      return newWarehouses;
    });
  }, []);

  // Защищенный крафтинг
  const startCrafting = useCallback((recipeId: string) => {
    const recipe = recipes.find(r => r.id === recipeId);
    if (!recipe) return;

    // Проверка ресурсов
    const mainWarehouse = warehouses.find(w => w.type === 'storage');
    if (!mainWarehouse) {
      toast.error('Главный склад не найден');
      return;
    }

    for (const ingredient of recipe.ingredients) {
      const item = mainWarehouse.items.find(i => i.id === ingredient.itemId);
      if (!item || item.quantity < ingredient.quantity) {
        toast.error(`Недостаточно ресурсов: ${ingredient.itemId}`);
        return;
      }
    }

    // Списание ресурсов
    setWarehouses(prev => {
      const newWarehouses = [...prev];
      const warehouse = newWarehouses.find(w => w.type === 'storage');
      if (!warehouse) return prev;

      for (const ingredient of recipe.ingredients) {
        const item = warehouse.items.find(i => i.id === ingredient.itemId);
        if (item) {
          item.quantity -= ingredient.quantity;
          warehouse.used -= ingredient.quantity;
          if (item.quantity === 0) {
            warehouse.items = warehouse.items.filter(i => i.id !== ingredient.itemId);
          }
        }
      }

      return newWarehouses;
    });

    // Добавление в очередь
    setCraftingQueue(prev => [...prev, { recipeId, startTime: Date.now() }]);
    
    setTimeout(() => {
      setCraftingQueue(prev => prev.filter(item => item.recipeId !== recipeId || item.startTime !== Date.now()));
      
      // Добавление результата
      setWarehouses(prev => {
        const newWarehouses = [...prev];
        const productionWarehouse = newWarehouses.find(w => w.type === 'production');
        if (!productionWarehouse) return prev;

        const existingItem = productionWarehouse.items.find(i => i.id === recipe.output.itemId);
        if (existingItem) {
          existingItem.quantity += recipe.output.quantity;
        } else {
          productionWarehouse.items.push({
            id: recipe.output.itemId,
            name: recipe.name,
            icon: '⚙️',
            quantity: recipe.output.quantity,
            maxStack: 20,
            rarity: 'rare'
          });
        }
        productionWarehouse.used += recipe.output.quantity;

        return newWarehouses;
      });
      
      toast.success(`Создано: ${recipe.output.quantity} ${recipe.name}`);
    }, recipe.craftingTime * 1000);

    toast.info(`Начат крафтинг: ${recipe.name}`);
  }, [warehouses, recipes]);

  const getRarityColor = (rarity: string) => {
    switch (rarity) {
      case 'common': return 'bg-gray-100 text-gray-800';
      case 'rare': return 'bg-blue-100 text-blue-800';
      case 'epic': return 'bg-purple-100 text-purple-800';
      case 'legendary': return 'bg-orange-100 text-orange-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getWarehouseTypeIcon = (type: string) => {
    switch (type) {
      case 'storage': return 'Warehouse';
      case 'production': return 'Factory';
      case 'logistics': return 'Truck';
      default: return 'Package';
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white">
      {/* Header */}
      <div className="bg-gradient-to-r from-orange-600 to-blue-600 p-6">
        <div className="max-w-7xl mx-auto">
          <h1 className="text-4xl font-bold mb-2" style={{ fontFamily: 'Orbitron, monospace' }}>
            3D Складской Инвентарь
          </h1>
          <p className="text-orange-100">Управление складами и производством с защитой от дублирования</p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto p-6">
        <Tabs defaultValue="warehouses" className="space-y-6">
          <TabsList className="grid w-full grid-cols-3 bg-slate-800 border-slate-700">
            <TabsTrigger value="warehouses" className="data-[state=active]:bg-orange-600">
              <Icon name="Warehouse" className="mr-2" size={16} />
              Склады
            </TabsTrigger>
            <TabsTrigger value="crafting" className="data-[state=active]:bg-blue-600">
              <Icon name="Hammer" className="mr-2" size={16} />
              Крафтинг
            </TabsTrigger>
            <TabsTrigger value="logistics" className="data-[state=active]:bg-purple-600">
              <Icon name="Truck" className="mr-2" size={16} />
              Логистика
            </TabsTrigger>
          </TabsList>

          <TabsContent value="warehouses" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {warehouses.map((warehouse) => (
                <Card key={warehouse.id} className="bg-slate-800 border-slate-700 hover:bg-slate-750 transition-all duration-300 hover:scale-105 hover:shadow-2xl">
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-white flex items-center gap-2">
                        <Icon name={getWarehouseTypeIcon(warehouse.type)} size={20} className="text-orange-400" />
                        {warehouse.name}
                      </CardTitle>
                      <Badge className={`${
                        warehouse.type === 'storage' ? 'bg-orange-600' :
                        warehouse.type === 'production' ? 'bg-blue-600' : 'bg-purple-600'
                      }`}>
                        {warehouse.type === 'storage' ? 'Хранение' :
                         warehouse.type === 'production' ? 'Производство' : 'Логистика'}
                      </Badge>
                    </div>
                    <CardDescription className="text-slate-400">
                      Загрузка: {warehouse.used}/{warehouse.capacity}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Progress 
                      value={(warehouse.used / warehouse.capacity) * 100} 
                      className="mb-4"
                    />
                    
                    <div className="space-y-2">
                      {warehouse.items.slice(0, 3).map((item) => (
                        <div key={item.id} className="flex items-center justify-between p-2 bg-slate-700 rounded-lg">
                          <div className="flex items-center gap-2">
                            <span className="text-lg">{item.icon}</span>
                            <span className="text-sm text-white">{item.name}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge className={getRarityColor(item.rarity)}>
                              {item.quantity}
                            </Badge>
                          </div>
                        </div>
                      ))}
                      
                      {warehouse.items.length > 3 && (
                        <div className="text-xs text-slate-400 text-center pt-2">
                          +{warehouse.items.length - 3} предметов
                        </div>
                      )}
                    </div>
                    
                    <Dialog>
                      <DialogTrigger asChild>
                        <Button className="w-full mt-4 bg-orange-600 hover:bg-orange-700">
                          <Icon name="Eye" size={16} className="mr-2" />
                          Подробнее
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="bg-slate-800 border-slate-700 text-white max-w-2xl">
                        <DialogHeader>
                          <DialogTitle className="flex items-center gap-2">
                            <Icon name={getWarehouseTypeIcon(warehouse.type)} size={20} className="text-orange-400" />
                            {warehouse.name}
                          </DialogTitle>
                          <DialogDescription>
                            Детальная информация о складе
                          </DialogDescription>
                        </DialogHeader>
                        <div className="space-y-4">
                          <div className="grid grid-cols-2 gap-4">
                            <div className="bg-slate-700 p-3 rounded-lg">
                              <div className="text-sm text-slate-400">Вместимость</div>
                              <div className="text-xl font-bold text-white">{warehouse.capacity}</div>
                            </div>
                            <div className="bg-slate-700 p-3 rounded-lg">
                              <div className="text-sm text-slate-400">Использовано</div>
                              <div className="text-xl font-bold text-white">{warehouse.used}</div>
                            </div>
                          </div>
                          
                          <div className="space-y-2">
                            <h4 className="font-semibold">Предметы в складе:</h4>
                            {warehouse.items.map((item) => (
                              <div key={item.id} className="flex items-center justify-between p-3 bg-slate-700 rounded-lg">
                                <div className="flex items-center gap-3">
                                  <span className="text-2xl">{item.icon}</span>
                                  <div>
                                    <div className="font-medium">{item.name}</div>
                                    <div className="text-sm text-slate-400">Макс. стак: {item.maxStack}</div>
                                  </div>
                                </div>
                                <div className="flex items-center gap-2">
                                  <Badge className={getRarityColor(item.rarity)}>
                                    {item.rarity}
                                  </Badge>
                                  <Badge variant="outline" className="border-slate-600 text-white">
                                    {item.quantity}
                                  </Badge>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </DialogContent>
                    </Dialog>
                  </CardContent>
                </Card>
              ))}
            </div>

            <Alert className="bg-slate-800 border-slate-700 text-white">
              <Icon name="Shield" className="h-4 w-4" />
              <AlertDescription>
                Система защищена от дублирования предметов и превышения лимитов складов
              </AlertDescription>
            </Alert>
          </TabsContent>

          <TabsContent value="crafting" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h3 className="text-2xl font-bold mb-4 text-white">Доступные рецепты</h3>
                <div className="space-y-4">
                  {recipes.map((recipe) => (
                    <Card key={recipe.id} className="bg-slate-800 border-slate-700">
                      <CardHeader>
                        <CardTitle className="text-white flex items-center gap-2">
                          <Icon name="Package" size={20} className="text-blue-400" />
                          {recipe.name}
                        </CardTitle>
                        <CardDescription className="text-slate-400">
                          Время создания: {recipe.craftingTime}с
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-3">
                          <div>
                            <h5 className="text-sm font-semibold text-slate-300 mb-2">Требуется:</h5>
                            <div className="flex flex-wrap gap-2">
                              {recipe.ingredients.map((ingredient, idx) => (
                                <Badge key={idx} variant="outline" className="border-slate-600 text-white">
                                  {ingredient.itemId}: {ingredient.quantity}
                                </Badge>
                              ))}
                            </div>
                          </div>
                          
                          <div className="flex items-center gap-2">
                            <Icon name="ArrowRight" size={16} className="text-slate-400" />
                            <Badge className="bg-green-600">
                              Результат: {recipe.output.quantity}
                            </Badge>
                          </div>
                          
                          <Button 
                            onClick={() => startCrafting(recipe.id)}
                            className="w-full bg-blue-600 hover:bg-blue-700"
                            disabled={craftingQueue.some(item => item.recipeId === recipe.id)}
                          >
                            {craftingQueue.some(item => item.recipeId === recipe.id) ? (
                              <><Icon name="Clock" size={16} className="mr-2" />В процессе...</>
                            ) : (
                              <><Icon name="Hammer" size={16} className="mr-2" />Создать</>
                            )}
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
              
              <div>
                <h3 className="text-2xl font-bold mb-4 text-white">Очередь создания</h3>
                <Card className="bg-slate-800 border-slate-700">
                  <CardContent className="pt-6">
                    {craftingQueue.length === 0 ? (
                      <div className="text-center text-slate-400 py-8">
                        <Icon name="Clock" size={48} className="mx-auto mb-4" />
                        <p>Очередь создания пуста</p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {craftingQueue.map((item, idx) => {
                          const recipe = recipes.find(r => r.id === item.recipeId);
                          const elapsed = (Date.now() - item.startTime) / 1000;
                          const progress = Math.min((elapsed / (recipe?.craftingTime || 1)) * 100, 100);
                          
                          return (
                            <div key={idx} className="p-3 bg-slate-700 rounded-lg">
                              <div className="flex items-center justify-between mb-2">
                                <span className="font-medium text-white">{recipe?.name}</span>
                                <Badge className="bg-blue-600">
                                  {Math.ceil((recipe?.craftingTime || 0) - elapsed)}с
                                </Badge>
                              </div>
                              <Progress value={progress} className="h-2" />
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="logistics" className="space-y-6">
            <div className="text-center py-12">
              <Icon name="Truck" size={64} className="mx-auto mb-4 text-purple-400" />
              <h3 className="text-2xl font-bold mb-2 text-white">Логистическая система</h3>
              <p className="text-slate-400 mb-6">Автоматическая транспортировка предметов между складами</p>
              
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 max-w-4xl mx-auto">
                <Card className="bg-slate-800 border-slate-700">
                  <CardContent className="pt-6 text-center">
                    <Icon name="RotateCcw" size={32} className="mx-auto mb-3 text-green-400" />
                    <h4 className="font-semibold text-white">Авто-сортировка</h4>
                    <p className="text-sm text-slate-400">Активна</p>
                  </CardContent>
                </Card>
                
                <Card className="bg-slate-800 border-slate-700">
                  <CardContent className="pt-6 text-center">
                    <Icon name="Zap" size={32} className="mx-auto mb-3 text-yellow-400" />
                    <h4 className="font-semibold text-white">Быстрая доставка</h4>
                    <p className="text-sm text-slate-400">Доступна</p>
                  </CardContent>
                </Card>
                
                <Card className="bg-slate-800 border-slate-700">
                  <CardContent className="pt-6 text-center">
                    <Icon name="Shield" size={32} className="mx-auto mb-3 text-blue-400" />
                    <h4 className="font-semibold text-white">Защита грузов</h4>
                    <p className="text-sm text-slate-400">100% гарантия</p>
                  </CardContent>
                </Card>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default Index;