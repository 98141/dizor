"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";

export default function LoginPage() {
  const router = useRouter();
  const { login } = useAuth();

  const [form, setForm] = useState({
    email: "",
    password: "",
  });

  const [message, setMessage] = useState("");

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage("");

    try {
      await login(form);
      router.push("/cuenta");
    } catch (error) {
      setMessage(error.response?.data?.message || "Error al iniciar sesión.");
    }
  };

  return (
    <main>
      <h1>Iniciar sesión</h1>

      <form onSubmit={handleSubmit}>
        <input name="email" placeholder="Correo" onChange={handleChange} />
        <input
          name="password"
          type="password"
          placeholder="Contraseña"
          onChange={handleChange}
        />

        <button type="submit">Entrar</button>
      </form>

      {message && <p>{message}</p>}
    </main>
  );
}