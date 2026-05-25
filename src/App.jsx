import { useState, useEffect } from "react";
import { useAuth } from "./hooks/useAuth";
import Login from "./components/Login";
import Chat from "./components/Chat";
import Onboarding from "./components/Onboarding";
import { salvarUsuario, buscarPerfil } from "./services/firestoreService";

const C = { bg: "#0A0E1A", text: "#F1F5F9" };

function Loading({ mensagem = "Carregando..." }) {
  return (
    <div style={{
      minHeight: "100vh", background: C.bg,
      display: "flex", alignItems: "center", justifyContent: "center",
      fontFamily: "sans-serif",
    }}>
      <div style={{ textAlign: "center" }}>
        <div style={{
          width: 60, height: 60, borderRadius: "50%",
          background: "linear-gradient(135deg, #1D6FE8, #F59E0B)",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 28, margin: "0 auto 16px",
          animation: "spin 1.5s linear infinite",
        }}>🛡️</div>
        <p style={{ color: C.text, fontSize: 14 }}>{mensagem}</p>
      </div>
      <style>{`@keyframes spin { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }`}</style>
    </div>
  );
}

export default function App() {
  const { user, loadingAuth, loginGoogle, logout } = useAuth();
  const [perfil, setPerfil] = useState(null);
  const [loadingPerfil, setLoadingPerfil] = useState(false);

  // Quando o usuário loga, busca/cria o perfil no Firestore
  useEffect(() => {
    if (!user) {
      setPerfil(null);
      return;
    }

    async function carregarPerfil() {
      setLoadingPerfil(true);
      try {
        const dados = await salvarUsuario(user);     // cria ou atualiza último_acesso
        const perfilAtual = await buscarPerfil(user.uid);
        setPerfil(perfilAtual || dados);
      } catch (e) {
        console.error("Erro ao carregar perfil:", e);
        setPerfil({});
      } finally {
        setLoadingPerfil(false);
      }
    }

    carregarPerfil();
  }, [user]);

  // Estados de carregamento
  if (loadingAuth) return <Loading mensagem="Verificando autenticação..." />;
  if (!user) return <Login onLogin={loginGoogle} />;
  if (loadingPerfil) return <Loading mensagem="Carregando seu perfil..." />;

  // Fluxo de onboarding: se o perfil ainda não tem CPF/Placa
  if (perfil && !perfil.onboarding_completo) {
    return (
      <Onboarding
        user={user}
        onConcluir={async () => {
          // Após salvar, recarrega o perfil para pegar os dados atualizados
          const atualizado = await buscarPerfil(user.uid);
          setPerfil(atualizado);
        }}
      />
    );
  }

  // Chat principal
  return <Chat user={user} perfil={perfil} onLogout={logout} />;
}
