import { useRef, useState } from 'react';

import globalize from 'lib/globalize';

import {
    avatarUrl, changePassword, deleteAvatar, uploadAvatar,
    type CurrentUser
} from '../../../domain/api';
import { useToast } from '../../components/toast/ToastProvider';
import { AvatarPickerDialog } from './AvatarPickerDialog';
import {
    InfoRow, SectionTitle, btnDanger, btnSecondary, inputStyle
} from './ui';

export function ProfileSection({
    user, serverUrl, onAvatarChange, logout
}: {
    user: CurrentUser; serverUrl: string; onAvatarChange: () => void; logout: () => void;
}) {
    const toast = useToast();
    const fileRef = useRef<HTMLInputElement>(null);
    const [busy, setBusy] = useState(false);
    const [pwCurrent, setPwCurrent] = useState('');
    const [pwNew, setPwNew] = useState('');
    const [pwRepeat, setPwRepeat] = useState('');
    const [pwBusy, setPwBusy] = useState(false);
    const [pickerOpen, setPickerOpen] = useState(false);

    const onUpload = async (file: File) => {
        setBusy(true);
        try {
            await uploadAvatar(file);
            toast(globalize.translate('ImageSaved'), 'success');
            onAvatarChange();
        } catch (e) {
            toast((e as Error).message, 'warn');
        } finally {
            setBusy(false);
        }
    };

    const onDeleteAvatar = async () => {
        setBusy(true);
        try {
            await deleteAvatar();
            toast(globalize.translate('ImageDeleted'), 'success');
            onAvatarChange();
        } catch (e) {
            toast((e as Error).message, 'warn');
        } finally {
            setBusy(false);
        }
    };

    const onChangePassword = async () => {
        if (!pwNew) return toast(globalize.translate('MessagePasswordRequired'), 'warn');
        if (pwNew !== pwRepeat) return toast(globalize.translate('PasswordMatchError'), 'warn');
        setPwBusy(true);
        try {
            await changePassword(pwCurrent, pwNew);
            toast(globalize.translate('PasswordSaved'), 'success');
            setPwCurrent(''); setPwNew(''); setPwRepeat('');
        } catch (e) {
            toast(globalize.translate('PasswordSaveError', (e as Error).message), 'warn');
        } finally {
            setPwBusy(false);
        }
    };

    return (
        <div>
            <SectionTitle>{globalize.translate('Profile')}</SectionTitle>

            <div style={{ display: 'flex', alignItems: 'center', gap: 24, marginBottom: 36 }}>
                {user.avatarTag ? (
                    <img
                        src={avatarUrl(user.avatarTag)}
                        alt={user.name}
                        style={{
                            width: 112, height: 112, borderRadius: '50%', objectFit: 'cover',
                            border: '1px solid rgba(255,255,255,0.2)'
                        }}
                    />
                ) : (
                    <div style={{
                        width: 112, height: 112, borderRadius: '50%',
                        background: 'linear-gradient(135deg,#d9a566,#3a1f10)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 42, fontWeight: 600
                    }}>
                        {user.name.slice(0, 1).toUpperCase()}
                    </div>
                )}
                <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                    <input
                        ref={fileRef} type='file' accept='image/*' style={{ display: 'none' }}
                        onChange={(e) => {
                            const f = e.target.files?.[0];
                            if (f) void onUpload(f);
                            e.target.value = '';
                        }}
                    />
                    <button style={btnSecondary} disabled={busy} onClick={() => setPickerOpen(true)}>
                        {globalize.translate('AvatarPickerOpen')}
                    </button>
                    <button style={btnSecondary} disabled={busy} onClick={() => fileRef.current?.click()}>
                        {globalize.translate('UploadCustomImage')}
                    </button>
                    {user.avatarTag && (
                        <button style={btnDanger} disabled={busy} onClick={onDeleteAvatar}>
                            {globalize.translate('DeleteImage')}
                        </button>
                    )}
                </div>
            </div>

            {pickerOpen && (
                <AvatarPickerDialog
                    onClose={() => setPickerOpen(false)}
                    onApplied={() => {
                        onAvatarChange();
                        setPickerOpen(false);
                    }}
                />
            )}

            <InfoRow label={globalize.translate('LabelUsername')} value={user.name} />
            <InfoRow label={globalize.translate('TabServer')} value={serverUrl} />
            <InfoRow
                label={globalize.translate('LabelLastActivity')}
                value={user.lastLogin ?
                    new Date(user.lastLogin).toLocaleString(globalize.getCurrentDateTimeLocale()) :
                    '—'}
            />
            <InfoRow
                label={globalize.translate('LabelPersonRole')}
                value={globalize.translate(user.isAdmin ? 'Administrator' : 'LabelUser')}
            />

            <SectionTitle style={{ marginTop: 44 }}>
                {globalize.translate('HeaderChangePassword')}
            </SectionTitle>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, maxWidth: 380 }}>
                {user.hasPassword && (
                    <input
                        type='password' placeholder={globalize.translate('LabelCurrentPassword')}
                        value={pwCurrent}
                        onChange={(e) => setPwCurrent(e.target.value)} style={inputStyle}
                        autoComplete='current-password'
                    />
                )}
                <input
                    type='password' placeholder={globalize.translate('LabelNewPassword')} value={pwNew}
                    onChange={(e) => setPwNew(e.target.value)} style={inputStyle}
                    autoComplete='new-password'
                />
                <input
                    type='password' placeholder={globalize.translate('LabelNewPasswordConfirm')}
                    value={pwRepeat}
                    onChange={(e) => setPwRepeat(e.target.value)} style={inputStyle}
                    autoComplete='new-password'
                />
                <div style={{ display: 'flex', gap: 12 }}>
                    <button style={btnSecondary} disabled={pwBusy} onClick={onChangePassword}>
                        {globalize.translate(pwBusy ? 'Saving' : 'HeaderChangePassword')}
                    </button>
                </div>
            </div>

            <div style={{ marginTop: 44 }}>
                <button onClick={logout} style={btnDanger}>
                    {globalize.translate('ButtonSignOut')}
                </button>
            </div>
        </div>
    );
}
