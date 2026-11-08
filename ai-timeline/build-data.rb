#!/usr/bin/env ruby

require "json"

root = File.expand_path(__dir__)
source_path = File.join(root, "timeline.md")
output_path = File.join(root, "timeline-data.json")
source = File.read(source_path, encoding: "UTF-8")

event_pattern = /^<!-- event: (\d{4}-\d{2}(?:-\d{2})?); actors: ([^;]+); tags: ([^;]+) -->$/
matches = []
source.to_enum(:scan, event_pattern).each do
  match = Regexp.last_match
  matches << { start: match.begin(0), date: match[1], actors: match[2], tags: match[3] }
end

def plain_text(value)
  value.to_s
    .gsub(/\[([^\]]+)\]\([^)]+\)/, '\\1')
    .gsub(/[*_`]/, "")
    .gsub(/\s+/, " ")
    .strip
end

events = matches.each_with_index.map do |metadata, index|
  stop = matches[index + 1]&.fetch(:start) || source.index(/^# Strategic balance/, metadata[:start]) || source.length
  block = source[metadata[:start]...stop]
  heading = block[/^### (.+)$/, 1] or abort "Missing event heading at #{metadata[:date]}"
  display_date, title = heading.split(" — ", 2)
  body = block.match(
    /\*\*Development\.\*\*\s*(.*?)\s+\*\*Technical change\.\*\*\s*(.*?)\s+\*\*What it meant\.\*\*\s*(.*?)\s+\*\*Contemporary reaction\.\*\*\s*(.*?)\s+\*\*Power shift\.\*\*\s*(.*?)(?=\n\n\*\*(?:Why it felt different\.|Sources?:)\*\*)/m
  ) or abort "Missing structured body: #{heading}"

  power = body[5].strip
  gained = power[/\*\*Gained:\*\*\s*(.*?)\s+\*\*Lost:\*\*/m, 1]
  lost = power[/\*\*Lost:\*\*\s*(.*)\z/m, 1]
  why = block[/\*\*Why it felt different\.\*\*\s*(.*?)(?=\n\n\*\*Sources?:\*\*)/m, 1]
  sources = block.scan(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/).map { |label, url| { label: plain_text(label), url: url } }
  slug = title.downcase.gsub(/[^a-z0-9]+/, "-").gsub(/^-|-$/, "")[0, 72]

  {
    id: "event-#{metadata[:date]}-#{slug}",
    date: metadata[:date],
    displayDate: display_date,
    year: metadata[:date][0, 4].to_i,
    title: title,
    actors: metadata[:actors].split(",").map(&:strip),
    tags: metadata[:tags].split(",").map(&:strip),
    inflection: metadata[:tags].split(",").include?("inflection-point"),
    development: plain_text(body[1]),
    technicalChange: plain_text(body[2]),
    meaning: plain_text(body[3]),
    reaction: plain_text(body[4]),
    gained: plain_text(gained || power),
    lost: plain_text(lost),
    whyItFeltDifferent: plain_text(why),
    sources: sources
  }
end

abort "Expected 224 events, found #{events.length}" unless events.length == 224
abort "An event is missing sources" if events.any? { |event| event[:sources].empty? }

power_section = source[/# Strategic balance at the cutoff\n(.*?)\n## Eight structural shifts/m, 1] or abort "Missing power balance"
power_balance = power_section.lines.map do |line|
  next unless line.start_with?("| **")
  cells = line.strip.split("|", -1)[1..-2].map(&:strip)
  next unless cells.length == 4
  { actor: plain_text(cells[0]), power: plain_text(cells[1]), constraint: plain_text(cells[2]), direction: plain_text(cells[3]) }
end.compact

shifts_section = source[/## Eight structural shifts across the period\n(.*?)\n# Website ingestion contract/m, 1] or abort "Missing structural shifts"
structural_shifts = shifts_section.scan(/^\d+\. \*\*(.+?)\.\*\*\s*(.+)$/).map do |title, description|
  { title: plain_text(title), description: plain_text(description) }
end

abort "Expected 18 power-balance rows, found #{power_balance.length}" unless power_balance.length == 18
abort "Expected 8 structural shifts, found #{structural_shifts.length}" unless structural_shifts.length == 8

document = {
  title: "The AI Power Map",
  cutoff: "2026-08-21",
  version: "1.1",
  eventCount: events.length,
  sourceCount: events.sum { |event| event[:sources].length },
  years: events.group_by { |event| event[:year] }.transform_values(&:length),
  powerBalance: power_balance,
  structuralShifts: structural_shifts,
  events: events
}

File.write(output_path, JSON.pretty_generate(document) + "\n")
puts "Wrote #{events.length} events to #{output_path}"
