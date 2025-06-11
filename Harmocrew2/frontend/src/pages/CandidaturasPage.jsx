import React, { useEffect, useState, useCallback } from "react";
import { useAuth } from "../context/AuthContext";
import styles from "../styles/CandidaturasPage.module.css"; 
import { Link } from "react-router-dom";

const CandidaturasPage = () => {
  const { token, logout } = useAuth();
  const [candidaturasAgrupadas, setCandidaturasAgrupadas] = useState({});
  const [projetosExpandidos, setProjetosExpandidos] = useState({});
  const [loading, setLoading] = useState(true);

  const fetchCandidaturas = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("http://localhost:5000/candidaturas_recebidas", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();

      if (res.ok) {
        const agrupadas = (data.candidaturas || []).reduce((acc, cand) => {
          const { post_id, titulo_post } = cand;
          if (!acc[post_id]) {
            acc[post_id] = {
              titulo: titulo_post,
              candidatos: [],
            };
          }
          acc[post_id].candidatos.push(cand);
          return acc;
        }, {});
        setCandidaturasAgrupadas(agrupadas);
      } else {
        alert(data.message || "Erro ao buscar candidaturas.");
        if (res.status === 401) logout();
      }
    } catch (error) {
      alert("Erro ao conectar com o servidor.");
      console.error("Fetch error:", error);
    } finally {
      setLoading(false);
    }
  }, [token, logout]);

  useEffect(() => {
    fetchCandidaturas();
  }, [fetchCandidaturas]);

  const toggleProjeto = (postId) => {
    setProjetosExpandidos((prev) => ({
      ...prev,
      [postId]: !prev[postId],
    }));
  };

  const handleAtualizarStatus = async (candidaturaId, postId, acao, e) => {
    e.stopPropagation();
    try {
      const res = await fetch(
        `http://localhost:5000/candidaturas/${candidaturaId}/${acao}`,
        {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      const data = await res.json();

      if (res.ok) {
        setCandidaturasAgrupadas((prev) => {
          const novosAgrupados = { ...prev };
          const candidatosDoPost = novosAgrupados[postId].candidatos.map(
            (c) => {
              if (c.candidatura_id === candidaturaId) {
                return { ...c, status: acao === 'aceitar' ? 'aceito' : 'rejeitado' };
              }
              return c;
            }
          );
          novosAgrupados[postId].candidatos = candidatosDoPost;
          return novosAgrupados;
        });
        alert(data.message);
      } else {
        alert(data.message || `Erro ao ${acao} candidatura.`);
        if (res.status === 401) logout();
      }
    } catch (error) {
      alert("Erro de conexão ao atualizar status.");
      console.error("Update status error:", error);
    }
  };

  return (
    <div className={styles.pageWrapper}>
      {}
      <div className={styles.leftColumn}>
        <h1 className={styles.pageTitle}>Candidaturas</h1>
      </div>

      {}
      <div className={styles.rightColumn}>
        {loading ? (
          <div className={styles.loading}>Carregando...</div>
        ) : Object.keys(candidaturasAgrupadas).length === 0 ? (
          <p className={styles.noCandidaturas}>Nenhuma candidatura recebida ainda.</p>
        ) : (
          Object.entries(candidaturasAgrupadas).map(([postId, projeto]) => (
            <div key={postId} className={styles.projetoContainer}>
              <div
                className={styles.projetoHeader}
                onClick={() => toggleProjeto(postId)}
              >
                <h3>{projeto.titulo}</h3>
                <span className={styles.toggleIcon}>{projetosExpandidos[postId] ? "▲" : "▼"}</span>
              </div>

              {projetosExpandidos[postId] && (
                <div className={styles.candidatosList}>
                  {projeto.candidatos.map((c) => (
                    <div key={c.candidatura_id} className={`${styles.candidatoCard} ${styles[c.status]}`}>
                      <img
                        src={c.candidato_profile_pic_url || 'https://i.pravatar.cc/40'}
                        alt={c.nome_candidato}
                        className={styles.candidatoAvatar}
                      />
                      <div className={styles.candidatoInfo}>
                        <span className={styles.candidatoNome}>{c.nome_candidato}</span>
                        <a
                          href={c.link_portfolio || '#'}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={styles.candidatoPortfolio}
                          onClick={(e) => e.stopPropagation()}
                        >
                          link.portfolio.exemplo
                        </a>
                      </div>
                      <div className={styles.actions}>
                        {c.status !== 'aceito' && (
                          <button
                            className={`${styles.actionButton} ${styles.accept}`}
                            onClick={(e) => handleAtualizarStatus(c.candidatura_id, postId, 'aceitar', e)}
                            title="Aceitar"
                          >
                            +
                          </button>
                        )}
                        {c.status !== 'rejeitado' && (
                          <button
                            className={`${styles.actionButton} ${styles.reject}`}
                            onClick={(e) => handleAtualizarStatus(c.candidatura_id, postId, 'rejeitar', e)}
                            title="Recusar"
                          >
                            &#x2715;
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                  <button className={styles.confirmButton}>Confirmar Seleção</button>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default CandidaturasPage;