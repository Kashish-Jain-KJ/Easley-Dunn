import {
  Play,
  Database,
  Shield,
  BarChart2,
  Mail,
  Bolt,
  Lock,
  Calendar,
  FileText
} from "lucide-react";

export const getServiceIcon = (serviceCode, serviceName) => {
  const code = serviceCode?.toUpperCase() || "";
  const name = serviceName?.toLowerCase() || "";

  if (code.includes("PLAY") || name.includes("play")) return Play;
  if (code.includes("BIG_QUERY") || code.includes("BIGQUERY") || name.includes("bigquery") || name.includes("big query") || name.includes("database")) return Database;
  if (code.includes("DRIVE") || name.includes("drive")) return Shield;
  if (code.includes("ANALYTICS") || name.includes("analytics")) return BarChart2;
  if (name.includes("email") || name.includes("mail")) return Mail;
  if (name.includes("slack")) return Bolt;
  if (name.includes("github") || name.includes("organization") || name.includes("vpn") || name.includes("access")) return Lock;
  if (name.includes("calendar")) return Calendar;
  if (name.includes("confluence") || name.includes("jira") || name.includes("wiki")) return FileText;

  return Shield;
};

export const getInitials = (name) => {
  if (!name) return "";
  const parts = name.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "";
  if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
  const first = parts[0]?.charAt(0) || "";
  const last = parts[parts.length - 1]?.charAt(0) || "";
  return (first + last).toUpperCase();
};

export const getAvatarColor = (name) => {
  if (!name) return "bg-[#2563eb] text-white";
  const colors = [
    "bg-[#2563eb] text-white", // Blue
    "bg-[#059669] text-white", // Green
    "bg-[#d97706] text-white", // Amber/Orange
    "bg-[#e11d48] text-white", // Rose/Pink-Red
    "bg-[#4f46e5] text-white", // Indigo
    "bg-[#7c3aed] text-white", // Purple
    "bg-[#db2777] text-white", // Pink
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % colors.length;
  return colors[index];
};
