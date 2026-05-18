"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";

export default function RegisterPage() {
  const router = useRouter();
  const { register } = useAuth();

  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    phone: "",
  });

  const [message, setMessage] = useState("");

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage("");

    try {
      await register(form);
      router.push("/cuenta");
    } catch (error) {
      setMessage(error.response?.data?.message || "Error al registrarse.");
    }
  };

  return (
    <main>
      <h1>Crear cuenta</h1>

      <form onSubmit={handleSubmit}>
        <input name="name" placeholder="Nombre" onChange={handleChange} />
        <input name="email" placeholder="Correo" onChange={handleChange} />
        <input
          name="password"
          type="password"
          placeholder="Contraseña"
          onChange={handleChange}
        />
        <input name="phone" placeholder="Teléfono" onChange={handleChange} />

        <button type="submit">Registrarme</button>
      </form>

      {message && <p>{message}</p>}
    </main>
  );
}