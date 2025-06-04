import React, { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import styles from "../styles/CandidaturasPage.module.css";

const CandidaturasPage = () => {
  const { token, logout } = useAuth();
  const [candidaturas, setCandidaturas] = useState([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedCandidatura, setSelectedCandidatura] = useState(null);
  const [aprovados, setAprovados] = useState({});

  useEffect(() => {
    const fetchCandidaturas = async () => {
      try {
        const res = await fetch(
          "http://localhost:5000/candidaturas_recebidas",
          {
            headers: { Authorization: `Bearer ${token}` },
          }
        );
        const data = await res.json();
        if (res.ok) {
          setCandidaturas(data.candidaturas);
          const aprovadosInit = {};
          data.candidaturas.forEach((c) => {
            if (c.status === "aceitar") {
              if (!aprovadosInit[c.post_id]) aprovadosInit[c.post_id] = [];
              aprovadosInit[c.post_id].push(c);
            }
          });

          setAprovados(aprovadosInit);
        } else {
          alert(data.message || "Erro ao buscar candidaturas.");
          if (res.status === 401) logout();
        }
      } catch {
        alert("Erro ao conectar com o servidor.");
      }
    };
    fetchCandidaturas();
  }, [token, logout]);

  const abrirModal = (candidatura) => {
    setSelectedCandidatura(candidatura);
    setModalOpen(true);
  };

  const fecharModal = () => {
    setSelectedCandidatura(null);
    setModalOpen(false);
  };

  const atualizarStatus = async (acao) => {
    if (!selectedCandidatura) return;

    try {
      const res = await fetch(
        `http://localhost:5000/candidaturas/${selectedCandidatura.candidatura_id}/${acao}`,
        {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      const data = await res.json();
      if (res.ok) {
        alert(data.message);
        setCandidaturas((prev) =>
          prev.map((c) =>
            c.candidatura_id === selectedCandidatura.candidatura_id
              ? { ...c, status: acao }
              : c
          )
        );

        if (acao === "aceitar") {
          setAprovados((prev) => {
            const postId = selectedCandidatura.post_id;
            const novosAprovados = prev[postId] ? [...prev[postId]] : [];
            // Evita duplicar
            if (
              !novosAprovados.find(
                (c) => c.candidatura_id === selectedCandidatura.candidatura_id
              )
            ) {
              novosAprovados.push({
                ...selectedCandidatura,
                status: "aceitar",
              });
            }
            return { ...prev, [postId]: novosAprovados };
          });
        } else if (acao === "rejeitar") {
          setAprovados((prev) => {
            const postId = selectedCandidatura.post_id;
            if (!prev[postId]) return prev;
            return {
              ...prev,
              [postId]: prev[postId].filter(
                (c) => c.candidatura_id !== selectedCandidatura.candidatura_id
              ),
            };
          });
        }

        fecharModal();
      } else {
        alert(data.message || "Erro ao atualizar status.");
        if (res.status === 401) logout();
      }
    } catch {
      alert("Erro ao conectar com o servidor.");
    }
  };

  return (
    <div className={styles.container}>
      <h2>Candidaturas Recebidas</h2>

      {candidaturas.length === 0 ? (
        <p>Nenhuma candidatura recebida ainda.</p>
      ) : (
        <>
          {candidaturas.map((c) => (
            <div
              key={c.candidatura_id}
              className={styles.card}
              onClick={() => abrirModal(c)}
              style={{ cursor: "pointer" }}
            >
              <p>
                <strong>Projeto:</strong> {c.texto_post}
              </p>
              <p>
                <strong>Artista:</strong> {c.nome_candidato} (
                {c.email_candidato})
              </p>
              <p>
                <strong>Data:</strong>{" "}
                {new Date(c.data_candidatura).toLocaleString()}
              </p>
              <p>
                <strong>Status:</strong> {c.status || "Pendente"}
              </p>
            </div>
          ))}

          <h3>Candidatos Aprovados</h3>
{Object.entries(aprovados).length === 0 ? (
  <p>Nenhum candidato aprovado ainda.</p>
) : (
  Object.entries(aprovados).map(([postId, aprovadosDoPost]) => (
    <div key={postId} className={styles.aprovadosContainer}>
      <h4>Projeto: {aprovadosDoPost[0]?.texto_post || `ID ${postId}`}</h4>
      <ul>
        {aprovadosDoPost.map((ap) => (
          <li key={ap.candidatura_id}>
            {ap.nome_candidato} ({ap.email_candidato}) — Candidatura aceita em{" "}
            {new Date(ap.data_candidatura).toLocaleString()}
          </li>
        ))}
      </ul>
    </div>
  ))
)}


          {modalOpen && selectedCandidatura && (
            <div className={styles.modalOverlay} onClick={fecharModal}>
              <div
                className={styles.modalContent}
                onClick={(e) => e.stopPropagation()}
              >
                <h3>Detalhes da Candidatura</h3>
                <p>
                  <strong>Projeto:</strong> {selectedCandidatura.texto_post}
                </p>
                <p>
                  <strong>Artista:</strong> {selectedCandidatura.nome_candidato}{" "}
                  ({selectedCandidatura.email_candidato})
                </p>
                <p>
                  <strong>Data:</strong>{" "}
                  {new Date(
                    selectedCandidatura.data_candidatura
                  ).toLocaleString()}
                </p>
                <p>
                  <strong>Status:</strong>{" "}
                  {selectedCandidatura.status || "Pendente"}
                </p>

                <div className={styles.buttons}>
                  {selectedCandidatura.status !== "aceitar" && (
                    <button
                      className={styles.acceptButton}
                      onClick={() => atualizarStatus("aceitar")}
                    >
                      Aceitar
                    </button>
                  )}
                  {selectedCandidatura.status !== "rejeitar" && (
                    <button
                      className={styles.rejectButton}
                      onClick={() => atualizarStatus("rejeitar")}
                    >
                      Rejeitar
                    </button>
                  )}
                  <button onClick={fecharModal}>Fechar</button>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default CandidaturasPage;
