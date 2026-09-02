// ============================================================
//  RentalFlow  |  Sprint 4  |  Owner: M4 - Radowanul Haque (Radowan)
//  Part: F20 Staff accounts + audit log console (admin only)
// ============================================================
import { useEffect, useState } from "react";
import { api } from "../api.js";
import { useAuth } from "../auth.jsx";
import { Icon } from "../icons.jsx";
import { StatTile, BarChart } from "../components/Charts.jsx";

const ROLES = ["admin", "staff", "member"];
const EMPTY = { name: "", email: "", password: "", role: "staff" };

export default function Admin() {
	const { user } = useAuth();
	const [tab, setTab] = useState("staff");
	const [users, setUsers] = useState([]);
	const [audit, setAudit] = useState([]);
	const [summary, setSummary] = useState(null);
	const [entityFilter, setEntityFilter] = useState("");
	const [form, setForm] = useState(EMPTY);
	const [showForm, setShowForm] = useState(false);
	const [error, setError] = useState("");
	const [success, setSuccess] = useState("");

	async function load() {
		const q = entityFilter
			? `?entity=${encodeURIComponent(entityFilter)}`
			: "";
		const [userData, auditData, summaryData] = await Promise.all([
			api.get("/admin/users"),
			api.get(`/admin/audit${q}`),
			api.get("/admin/audit/summary"),
		]);
		setUsers(userData);
		setAudit(auditData);
		setSummary(summaryData);
	}

	useEffect(() => {
		load().catch((err) => setError(err.message));
	}, [entityFilter]);

	async function createStaff(e) {
		e.preventDefault();
		setError("");
		try {
			const created = await api.post("/admin/users", form);
			setSuccess(`${created.name} added as ${created.role}.`);
			setForm(EMPTY);
			setShowForm(false);
			load();
		} catch (err) {
			setError(err.message);
		}
	}

	async function updateUser(id, patch, message) {
		try {
			await api.patch(`/admin/users/${id}`, patch);
			setSuccess(message);
			load();
		} catch (err) {
			setError(err.message);
		}
	}

	if (user?.role !== "admin") {
		return (
			<div className="container">
				<div className="center-empty">
					<Icon name="shield" size={18} /> Admin console — your
					account does not have access.
				</div>
			</div>
		);
	}

	return (
		<div className="container">
			<div className="page-head">
				<div>
					<h1>Admin</h1>
					<div className="sub">
						Staff accounts and a full trail of who changed what.
					</div>
				</div>
				{tab === "staff" && (
					<button
						className="btn"
						onClick={() => setShowForm((v) => !v)}
					>
						<Icon name="user" size={15} />{" "}
						{showForm ? "Close" : "Add staff account"}
					</button>
				)}
			</div>

			{error && (
				<div className="error">
					<Icon name="shield" size={16} /> {error}
				</div>
			)}
			{success && (
				<div
					className="success"
					style={{ color: "var(--accent)", marginBottom: 16 }}
				>
					<Icon name="check" size={16} /> {success}
				</div>
			)}

			{summary && (
				<div className="stat-row">
					<StatTile
						label="Accounts"
						value={users.length}
						hint={`${users.filter((u) => u.role !== "member").length} staff / admin`}
					/>
					<StatTile
						label="Logged actions"
						value={summary.totals.total}
						hint={`${summary.totals.last24h} in the last 24 hours`}
					/>
					<StatTile
						label="Rejected actions"
						value={summary.totals.failed}
						hint="requests that failed or were denied"
						tone={
							summary.totals.failed ? "var(--amber)" : undefined
						}
					/>
					<StatTile
						label="Suspended"
						value={
							users.filter((u) => u.status === "suspended").length
						}
						hint="accounts blocked from the API"
					/>
				</div>
			)}

			<div className="toolbar">
				<button
					className={`btn small ${tab === "staff" ? "" : "secondary"}`}
					onClick={() => setTab("staff")}
				>
					Staff accounts
				</button>
				<button
					className={`btn small ${tab === "audit" ? "" : "secondary"}`}
					onClick={() => setTab("audit")}
				>
					Audit log
				</button>
			</div>

			{tab === "staff" && (
				<>
					{showForm && (
						<form className="form panel" onSubmit={createStaff}>
							<div className="row">
								<label className="field">
									<span>Name</span>
									<input
										value={form.name}
										onChange={(e) =>
											setForm({
												...form,
												name: e.target.value,
											})
										}
										required
									/>
								</label>
								<label className="field">
									<span>Email</span>
									<input
										type="email"
										value={form.email}
										onChange={(e) =>
											setForm({
												...form,
												email: e.target.value,
											})
										}
										required
									/>
								</label>
								<label className="field">
									<span>Temporary password</span>
									<input
										type="text"
										value={form.password}
										onChange={(e) =>
											setForm({
												...form,
												password: e.target.value,
											})
										}
										required
									/>
								</label>
								<label className="field">
									<span>Role</span>
									<select
										value={form.role}
										onChange={(e) =>
											setForm({
												...form,
												role: e.target.value,
											})
										}
									>
										{ROLES.map((r) => (
											<option key={r} value={r}>
												{r}
											</option>
										))}
									</select>
								</label>
							</div>
							<button className="btn" type="submit">
								<Icon name="plus" size={15} /> Create account
							</button>
						</form>
					)}

					<div className="table-wrap">
						<table className="data-table">
							<thead>
								<tr>
									<th>Account</th>
									<th>Role</th>
									<th className="num">Actions logged</th>
									<th>Last activity</th>
									<th>Status</th>
									<th />
								</tr>
							</thead>
							<tbody>
								{users.map((u) => (
									<tr key={u.id}>
										<td>
											<div className="cell-title">
												{u.name}
											</div>
											<div className="muted small">
												{u.email}
											</div>
										</td>
										<td>
											<select
												value={u.role}
												onChange={(e) =>
													updateUser(
														u.id,
														{
															role: e.target
																.value,
														},
														`${u.name} is now ${e.target.value}.`,
													)
												}
											>
												{ROLES.map((r) => (
													<option key={r} value={r}>
														{r}
													</option>
												))}
											</select>
										</td>
										<td className="num">
											{u.action_count}
										</td>
										<td className="muted">
											{u.last_action_at
												? String(
														u.last_action_at,
													).slice(0, 10)
												: "—"}
										</td>
										<td>
											<span
												className={
													u.status === "active"
														? "ok-text"
														: "warn-text"
												}
											>
												{u.status}
											</span>
										</td>
										<td>
											<button
												className="btn secondary small"
												onClick={() =>
													updateUser(
														u.id,
														{
															status:
																u.status ===
																"active"
																	? "suspended"
																	: "active",
														},
														u.status === "active"
															? `${u.name} suspended.`
															: `${u.name} reactivated.`,
													)
												}
											>
												{u.status === "active"
													? "Suspend"
													: "Reactivate"}
											</button>
										</td>
									</tr>
								))}
							</tbody>
						</table>
					</div>
				</>
			)}

			{tab === "audit" && (
				<>
					{summary && summary.byUser.length > 0 && (
						<section className="panel">
							<div className="panel-head">
								<h2>Actions per staff member</h2>
							</div>
							<BarChart
								data={summary.byUser.map((u) => ({
									label: u.label.split(" ")[0],
									value: u.value,
								}))}
								height={160}
								format={(n) => String(n)}
							/>
						</section>
					)}

					<div className="toolbar">
						<select
							value={entityFilter}
							onChange={(e) => setEntityFilter(e.target.value)}
						>
							<option value="">All areas</option>
							{(summary?.byEntity || []).map((e) => (
								<option key={e.label} value={e.label}>
									{e.label} ({e.value})
								</option>
							))}
						</select>
					</div>

					{audit.length === 0 ? (
						<div className="center-empty">
							No activity recorded yet.
						</div>
					) : (
						<div className="table-wrap">
							<table className="data-table">
								<thead>
									<tr>
										<th>When</th>
										<th>Who</th>
										<th>Action</th>
										<th>Target</th>
										<th>Result</th>
									</tr>
								</thead>
								<tbody>
									{audit.map((row) => (
										<tr key={row.id}>
											<td className="muted">
												{new Date(
													row.created_at,
												).toLocaleString()}
											</td>
											<td>
												{row.user_name || (
													<span className="muted">
														anonymous
													</span>
												)}
											</td>
											<td>
												<span className="tag">
													{row.action}
												</span>{" "}
												{row.entity}
												{row.entity_id
													? ` #${row.entity_id}`
													: ""}
											</td>
											<td className="muted small">
												{row.summary || row.path}
											</td>
											<td>
												<span
													className={
														row.status_code < 400
															? "ok-text"
															: "warn-text"
													}
												>
													{row.status_code}
												</span>
											</td>
										</tr>
									))}
								</tbody>
							</table>
						</div>
					)}
				</>
			)}
		</div>
	);
}
