'use client';
import { useState } from 'react';
import type { AgentModuleProps } from '@/types/agent';
import { PageHeader } from '@/components/blocks/PageHeader';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ProductsTab } from './catalog/ProductsTab';
import { CategoriesTab } from './catalog/CategoriesTab';
import { TaxRatesTab } from './catalog/TaxRatesTab';
import { SurchargesTab } from './catalog/SurchargesTab';

export function CatalogModule(props: AgentModuleProps) {
    const [tab, setTab] = useState('products');
    return (
        <div className="space-y-4">
            <PageHeader
                title="Catalog"
                description="Configure products, categories, tax rates and surcharges. Changes take effect immediately."
            />
            <Tabs value={tab} onValueChange={setTab}>
                <TabsList>
                    <TabsTrigger value="products">Products</TabsTrigger>
                    <TabsTrigger value="categories">Categories</TabsTrigger>
                    <TabsTrigger value="tax">Tax rates</TabsTrigger>
                    <TabsTrigger value="surcharges">Surcharges</TabsTrigger>
                </TabsList>
                <TabsContent value="products">
                    <ProductsTab {...props} />
                </TabsContent>
                <TabsContent value="categories">
                    <CategoriesTab {...props} />
                </TabsContent>
                <TabsContent value="tax">
                    <TaxRatesTab {...props} />
                </TabsContent>
                <TabsContent value="surcharges">
                    <SurchargesTab {...props} />
                </TabsContent>
            </Tabs>
        </div>
    );
}
