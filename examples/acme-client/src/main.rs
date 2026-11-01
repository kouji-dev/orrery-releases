//! `acme-client`: everything the built-in TUI draws, plus a Gantt chart for
//! the `acme.gantt` element (decision 0093). Any other client draws the
//! element's fallback, a table.

use orrery_client_ratatui::{Client, Component};
use ratatui::style::{Color, Style, Stylize};
use ratatui::text::{Line, Span};
use serde_json::Value;

/// `acme.gantt`: `{"title"?, "tasks": [{"name", "start", "end", "status"?}]}`,
/// days from the plan's start; `status` is `done`, `running` or `todo`.
struct Gantt;

/// The name column, and the narrowest bar worth drawing.
const NAME: usize = 12;
const MIN_BAR: usize = 8;

impl Component for Gantt {
    fn lines(&self, props: &Value, width: u16) -> Vec<Line<'static>> {
        let tasks = props["tasks"].as_array().cloned().unwrap_or_default();
        let mut out = Vec::new();
        if let Some(title) = props["title"].as_str() {
            out.push(Line::from(Span::styled(title.to_owned(), Style::new().bold())));
        }
        if tasks.is_empty() {
            out.push(Line::from(Span::styled("no tasks", Style::new().fg(Color::DarkGray))));
            return out;
        }
        let day = |t: &Value, k: &str| t[k].as_u64().unwrap_or(0);
        let span = tasks.iter().map(|t| day(t, "end")).max().unwrap_or(1).max(1);
        // Too narrow for a bar: one line per task, as text.
        let bar = usize::from(width).saturating_sub(NAME + 1);
        for t in &tasks {
            let name: String = t["name"].as_str().unwrap_or("?").chars().take(NAME).collect();
            let (start, end) = (day(t, "start").min(span), day(t, "end").min(span));
            if bar < MIN_BAR {
                out.push(Line::from(format!("{name} {start}-{end}d")));
                continue;
            }
            let at = |d: u64| (d as usize * bar).div_ceil(span as usize).min(bar);
            let (a, b) = (at(start), at(end).max(at(start) + 1).min(bar));
            let colour = match t["status"].as_str() {
                Some("done") => Color::Green,
                Some("running") => Color::Yellow,
                _ => Color::Blue,
            };
            out.push(Line::from(vec![
                Span::raw(format!("{name:<NAME$} ")),
                Span::styled("·".repeat(a), Style::new().fg(Color::DarkGray)),
                Span::styled("█".repeat(b - a), Style::new().fg(colour)),
                Span::styled("·".repeat(bar - b), Style::new().fg(Color::DarkGray)),
            ]));
        }
        out
    }
}

fn main() -> std::process::ExitCode {
    Client::builder().component("acme.gantt", Gantt).run()
}
