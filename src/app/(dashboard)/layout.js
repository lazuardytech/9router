import { DashboardLayout } from "@/shared/components";

export const metadata = {
  title: {
    template: "9Router • %s",
    default: "9Router",
  },
};

export default function DashboardRootLayout({ children }) {
  return <DashboardLayout>{children}</DashboardLayout>;
}
