import { PERMISSION_GROUPS, countPermissions } from "../accessControlConfig";
import AccessControlIcon from "./AccessControlIcon";

function MetricCard({ icon, label, value, detail, color, children }) {
  return (
    <article className="acl-metric">
      <div className="metric-top">
        <span>{label}</span>
        <span className={`metric-icon ${color}`}>
          <AccessControlIcon name={icon} size={17} />
        </span>
      </div>
      <div className="metric-value">{value}</div>
      <div className="metric-foot">
        <span>{detail}</span>
      </div>
      {children}
    </article>
  );
}

export default function AccessControlMetrics({ accounts, roles, matrix }) {
  const activeAccounts = accounts.filter(
    ({ status }) => status === "Hoạt động",
  ).length;
  const activeRate = accounts.length
    ? Math.round((activeAccounts / accounts.length) * 100)
    : 0;
  const totalAssignedPermissions = countPermissions(matrix);
  const definedPermissions = PERMISSION_GROUPS.reduce(
    (count, group) => count + group.permissions.length,
    0,
  );

  return (
    <section className="acl-metrics" aria-label="Tổng quan hệ thống">
      <MetricCard
        icon="users"
        label="TÀI KHOẢN NHÂN SỰ"
        value={accounts.length}
        detail={`${activeAccounts} tài khoản đang hoạt động`}
        color="metric-blue"
      >
        <div className="metric-spark spark-blue">
          <i />
          <i />
          <i />
          <i />
          <i />
          <i />
          <i />
          <i />
          <i />
          <i />
          <i />
          <i />
        </div>
      </MetricCard>
      <MetricCard
        icon="shield"
        label="VAI TRÒ"
        value={roles.length}
        detail="vai trò đang cấu hình"
        color="metric-teal"
      >
        <div className="metric-spark spark-teal">
          <i />
          <i />
          <i />
          <i />
          <i />
          <i />
          <i />
          <i />
          <i />
          <i />
          <i />
          <i />
        </div>
      </MetricCard>
      <MetricCard
        icon="lock"
        label="QUYỀN ĐÃ GÁN"
        value={totalAssignedPermissions}
        detail={`trên ${definedPermissions} quyền khả dụng`}
        color="metric-indigo"
      >
        <div className="metric-spark spark-indigo">
          <i />
          <i />
          <i />
          <i />
          <i />
          <i />
          <i />
          <i />
          <i />
          <i />
          <i />
          <i />
        </div>
      </MetricCard>
      <MetricCard
        icon="chart"
        label="TÀI KHOẢN HOẠT ĐỘNG"
        value={`${activeRate}%`}
        detail="tính từ danh sách đang hiển thị"
        color="metric-green"
      >
        <div className="metric-progress">
          <span style={{ width: `${activeRate}%` }} />
        </div>
      </MetricCard>
    </section>
  );
}
