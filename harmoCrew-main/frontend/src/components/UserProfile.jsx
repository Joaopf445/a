import React, { useEffect, useState, useCallback } from 'react';
import styles from '../styles/ProfilePage.module.css';
import { useParams } from 'react-router-dom';
import "../styles/global.css";
import "../styles/colors.css";

export default function UserProfile() {
  const { id } = useParams();
  const [user, setUser] = useState(null);
  const [projects, setProjects] = useState([]);
  const [amigos, setAmigos] = useState([]);
  const [activeTab, setActiveTab] = useState('projetos');
  const [loggedUserId, setLoggedUserId] = useState(null);
  const [isFollowing, setIsFollowing] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) return;

    fetch('http://localhost:5000/profile', {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(res => res.json())
      .then(data => {
        if (data.user) setLoggedUserId(data.user.id);
      })
      .catch(err => console.error("Erro ao buscar usuário logado:", err));
  }, []);

  const fetchFriends = useCallback(() => {
    const token = localStorage.getItem('token');
    if (!token || !user) return;

    fetch(`http://localhost:5000/followers/${user.id}`, {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(res => res.json())
      .then(data => {
        if (data.followers) {
          setAmigos(data.followers);
          const isAlreadyFollowing = data.followers.some(f => f.id === loggedUserId);
          setIsFollowing(isAlreadyFollowing);
        }
      })
      .catch(err => console.error("Erro ao buscar amigos:", err));
  }, [user, loggedUserId]);

  function handleFollow() {
    const token = localStorage.getItem('token');
    const action = isFollowing ? 'unfollow' : 'follow';

    fetch(`http://localhost:5000/${action}/${user.id}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(res => res.json())
      .then(data => {
        if (data.message.includes("sucesso")) {
          alert(data.message);
          setIsFollowing(!isFollowing);
          fetchFriends();
        } else {
          alert(data.message);
        }
      })
      .catch(err => console.error(`Erro ao tentar ${action}:`, err));
  }

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) return;

    fetch(`http://localhost:5000/user/${id}`, {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(res => res.json())
      .then(data => {
        if (data.user) {
          setUser(data.user);

          fetch('http://localhost:5000/posts', {
            headers: { Authorization: `Bearer ${token}` }
          })
            .then(res => res.json())
            .then(dataPosts => {
              const userProjects = dataPosts.posts.filter(post => post.user_id === data.user.id);
              setProjects(userProjects);
            });
        }
      })
      .catch(err => console.error("Erro ao buscar usuário:", err));
  }, [id]);

  useEffect(() => {
    if (user) {
      fetchFriends();
    }
  }, [user, fetchFriends]);

  if (!user) return <p>Carregando perfil...</p>;

  return (
    <div className={styles.container}>
      <div className={styles.profileSidebar}>
        <img
          className={styles.userPhoto}
          src={`https://i.pravatar.cc/150?u=${user.id}`}
          alt="Foto de perfil"
        />
        <h2>{user.nome}</h2>

        {loggedUserId !== user.id && (
          <button className={styles.followButton} onClick={handleFollow}>
            {isFollowing ? 'Deixar de seguir' : 'Seguir'}
          </button>
        )}

        <p className={styles.description}>
          Este é um exemplo de descrição do usuário. Você pode atualizar sua bio mais tarde.
        </p>
      </div>

      <div className={styles.profileContent}>
        <div className={styles.tabs}>
          <button
            className={activeTab === 'projetos' ? styles.activeTab : ''}
            onClick={() => setActiveTab('projetos')}
          >
            Projetos
          </button>
          <button
            className={activeTab === 'amigos' ? styles.activeTab : ''}
            onClick={() => setActiveTab('amigos')}
          >
            Amigos
          </button>
        </div>

        {activeTab === 'projetos' && (
          <div className={styles.projects}>
            {projects.length === 0 ? (
              <p>Este usuário ainda não criou projetos.</p>
            ) : (
              projects.map(post => (
                <div key={post.id} className={styles.projectCard}>
                  <p>{post.texto}</p>
                  <span>{post.data}</span>
                </div>
              ))
            )}
          </div>
        )}

        {activeTab === 'amigos' && (
          <div className={styles.friends}>
            {amigos.length === 0 ? (
              <p>Este usuário ainda não tem amigos.</p>
            ) : (
              amigos.map(amigo => (
                <div
                  key={amigo.id}
                  className={styles.friendCard}
                  onClick={() => window.location.href = `/usuario/${amigo.id}`}
                >
                  <img
                    src={amigo.foto || `https://i.pravatar.cc/100?u=${amigo.id}`}
                    alt={`Foto de ${amigo.nome}`}
                  />
                  <span>{amigo.nome}</span>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}