import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { KeyRound } from 'lucide-react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';

export default function JoinByCodeModal({ open, onClose }) {
  const [value, setValue] = useState('');
  const navigate = useNavigate();
  const code = (value.trim().match(/invite\/([A-Za-z0-9]+)/)?.[1] || value.trim()).toUpperCase().replace(/[^A-Z0-9]/g, '');
  const submit = () => {
    if (code.length < 6) return;
    onClose();
    setValue('');
    navigate(`/invite/${code}`);
  };
  return (
    <Modal
      open={open}
      onClose={onClose}
      icon={KeyRound}
      title="Rejoindre avec un code"
      description="Collez un lien d’invitation ou saisissez le code du salon."
      size="sm"
      footer={<Button variant="primary" onClick={submit} disabled={code.length < 6}>Continuer</Button>}
    >
      <input
        className="input text-center font-mono text-lg tracking-[0.25em] uppercase"
        autoFocus
        placeholder="ABCD2345"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && submit()}
      />
      <p className="mt-2 text-center text-xs text-subtle">Vous pouvez aussi scanner le QR code avec votre téléphone.</p>
    </Modal>
  );
}
