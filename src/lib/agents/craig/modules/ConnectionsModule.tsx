'use client';
import { useState } from 'react';
import { MessageCircle, AtSign } from 'lucide-react';
import type { AgentModuleProps } from '@/types/agent';
import { PageHeader } from '@/components/blocks/PageHeader';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { WidgetTab } from './connections/WidgetTab';
import { MissiveTab } from './connections/MissiveTab';
import { ComingSoonTab } from './connections/ComingSoonTab';

/**
 * Connections module — the channels Craig uses to reach customers.
 *
 * Today only the web widget is functional. WhatsApp / Missive / Email live
 * as "coming soon" placeholders so the shape of the UI is clear from day one.
 */
export function ConnectionsModule(props: AgentModuleProps) {
    const [tab, setTab] = useState('widget');

    return (
        <div className="space-y-4">
            <PageHeader
                title="Connections"
                description="Channels where Craig talks to customers. Enable what you need."
            />
            <Tabs value={tab} onValueChange={setTab}>
                <TabsList>
                    <TabsTrigger value="widget">Widget</TabsTrigger>
                    <TabsTrigger value="whatsapp">WhatsApp</TabsTrigger>
                    <TabsTrigger value="missive">Missive</TabsTrigger>
                    <TabsTrigger value="email">Email</TabsTrigger>
                </TabsList>

                <TabsContent value="widget">
                    <WidgetTab {...props} />
                </TabsContent>

                <TabsContent value="whatsapp">
                    <ComingSoonTab
                        name="WhatsApp"
                        icon={MessageCircle}
                        bullets={[
                            'Connect WhatsApp Business API (Meta Cloud or Twilio)',
                            'Incoming messages routed through Craig, drafts sent back for Justin to approve',
                            'Same DB — conversations from WhatsApp show up in the Conversations tab alongside web chat',
                        ]}
                    />
                </TabsContent>

                <TabsContent value="missive">
                    <MissiveTab {...props} />
                </TabsContent>

                <TabsContent value="email">
                    <ComingSoonTab
                        name="Email (SMTP)"
                        icon={AtSign}
                        bullets={[
                            'Generic email channel for providers other than Missive',
                            'Optional auto-reply with draft quote + human approval step',
                            'Useful for white-label customers with their own IMAP/SMTP',
                        ]}
                    />
                </TabsContent>
            </Tabs>
        </div>
    );
}
