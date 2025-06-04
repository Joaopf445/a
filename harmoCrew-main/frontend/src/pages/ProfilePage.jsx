import React, { useEffect, useState } from 'react';
import styles from '../styles/ProfilePage.module.css';
import { useAuth } from '../context/AuthContext';
import { useParams, useNavigate } from 'react-router-dom';
import "../styles/global.css";
import "../styles/colors.css";

export default function ProfilePage() {
  const { user: loggedUser } = useAuth();
  const { id } = useParams();
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [projects, setProjects] = useState([]);
  const [amigos, setAmigos] = useState([]);
  const [activeTab, setActiveTab] = useState('projetos');
  const [isFollowing, setIsFollowing] = useState(false);
  const token = localStorage.getItem('token');

  const checkIfFollowing = (followers) => {
    if (!loggedUser) return false;
    return followers.some(follower => follower.id === loggedUser.id);
  };

  useEffect(() => {
    if (!token) return;
    const userId = id ? parseInt(id) : loggedUser?.id;
    if (!userId) return;

    fetch(`http://localhost:5000/user/${userId}`, {
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
            .then(postsData => {
              if (postsData.posts) {
                const userProjects = postsData.posts.filter(post => post.user_id === data.user.id);
                setProjects(userProjects);
              }
            });

          fetch(`http://localhost:5000/followers/${userId}`, {
            headers: { Authorization: `Bearer ${token}` }
          })
            .then(res => res.json())
            .then(followersData => {
              if (followersData.followers) {
                setAmigos(followersData.followers);
                setIsFollowing(checkIfFollowing(followersData.followers));
              }
            });
        }
      });
  }, [id, loggedUser, token]);

  const handleFollowToggle = () => {
    if (!token || !user) return;

    const url = isFollowing
      ? `http://localhost:5000/unfollow/${user.id}`
      : `http://localhost:5000/follow/${user.id}`;

    fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    })
      .then(res => {
        if (res.ok) {
          setIsFollowing(!isFollowing);
          if (isFollowing) {
            setAmigos(prev => prev.filter(amigo => amigo.id !== loggedUser.id));
          } else {
            setAmigos(prev => [...prev, loggedUser]);
          }
        } else {
          console.error('Erro ao atualizar o status de seguir.');
        }
      });
  };

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

        {id && parseInt(id) !== loggedUser.id && (
          <button
            className={styles.followButton}
            onClick={handleFollowToggle}
          >
            {isFollowing ? 'Deixar de seguir' : 'Seguir'}
          </button>
        )}

        <p className={styles.description}>
          {/* Adicionei mais informações fictícias */}
          <strong>Email:</strong> {user.email || 'usuario@example.com'}<br />
          <strong>Username:</strong> @{user.nome.toLowerCase().replace(/ /g, '_')}<br />
          <strong>Bio:</strong> Este é um exemplo de descrição do usuário.
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
              <p>Este usuário não tem amigos para mostrar.</p>
            ) : (
              amigos.map(amigo => (
                <div
                  key={amigo.id}
                  className={styles.friendCard}
                  onClick={() => navigate(`/usuario/${amigo.id}`)}
                >
                  <img src={amigo.foto || `https://i.pravatar.cc/100?u=${amigo.id}`} alt="Amigo" />
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
