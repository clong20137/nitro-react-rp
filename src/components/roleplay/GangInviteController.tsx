import React, { useEffect, useState } from 'react';
import { SendMessageComposer } from '../../api';
import { GangInviteResponseComposer } from '@nitrots/nitro-renderer/src/nitro/communication/messages/outgoing/GangInviteResponseComposer';
import { GangInvitePopupView } from './GangInvitePopupView';

type InvitePayload = {
inviteId: number;
inviterId: number;
inviter: string;
gangName: string;
};

export const GangInviteController: React.FC = () =>
{
const [invite, setInvite] = useState<InvitePayload | null>(null);

useEffect(() =>
{
const onPopup = (e: Event) =>
{
const ce = e as CustomEvent<InvitePayload>;
if(!ce.detail) return;
setInvite(ce.detail);
};

window.addEventListener('gang_invite_popup', onPopup as EventListener);
return () => window.removeEventListener('gang_invite_popup', onPopup as EventListener);
}, []);

const accept = () =>
{
if(!invite) return;
try {
// ✅ accepted FIRST, then inviteId
SendMessageComposer(new GangInviteResponseComposer(true, invite.inviteId));
} finally {
setInvite(null);
}
};

const decline = () =>
{
if(!invite) return;
try {
SendMessageComposer(new GangInviteResponseComposer(false, invite.inviteId));
} finally {
setInvite(null);
}
};

if(!invite) return null;

return (
<GangInvitePopupView
inviter={invite.inviter}
gangName={invite.gangName}
onAccept={accept}
onDecline={decline}
/>
);
};

export default GangInviteController;
