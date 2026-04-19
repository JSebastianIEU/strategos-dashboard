import { LayoutDashboard, FileText, MessageSquare, Package, Plug, Settings } from 'lucide-react';
import type { AgentDefinition } from '@/types/agent';
import { OverviewModule } from './modules/OverviewModule';
import { QuotesModule } from './modules/QuotesModule';
import { ConversationsModule } from './modules/ConversationsModule';
import { ConnectionsModule } from './modules/ConnectionsModule';
import { CatalogModule } from './modules/CatalogModule';
import { SettingsModule } from './modules/SettingsModule';

export const craigDefinition: AgentDefinition = {
    slug: 'craig',
    name: 'Craig',
    description: 'AI quoting agent — generic pricing engine + customer-facing chat.',
    capabilities: ['overview', 'quotes', 'conversations', 'connections', 'catalog', 'settings'],
    modules: [
        {
            title: 'Overview',
            description: 'Stat cards + charts',
            icon: LayoutDashboard,
            route: 'overview',
            Component: OverviewModule,
            minRole: 'client_viewer',
        },
        {
            title: 'Quote Queue',
            description: 'Pending quotes waiting for approval',
            icon: FileText,
            route: 'quotes',
            Component: QuotesModule,
            minRole: 'client_viewer',
        },
        {
            title: 'Conversations',
            description: 'Customer chats — what Craig has been discussing',
            icon: MessageSquare,
            route: 'conversations',
            Component: ConversationsModule,
            minRole: 'client_viewer',
        },
        {
            title: 'Connections',
            description: 'Widget + channels where Craig reaches customers',
            icon: Plug,
            route: 'connections',
            Component: ConnectionsModule,
            minRole: 'client_owner',
        },
        {
            title: 'Catalog',
            description: 'Products, categories, tax rates and surcharges',
            icon: Package,
            route: 'catalog',
            Component: CatalogModule,
            minRole: 'client_owner',
        },
        {
            title: 'Settings',
            description: 'Personality, turnaround, artwork rate',
            icon: Settings,
            route: 'settings',
            Component: SettingsModule,
            minRole: 'client_owner',
        },
    ],
};
