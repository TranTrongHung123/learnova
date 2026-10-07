package com.learnova.session.service;

import com.learnova.audit.enums.AuditAction;
import com.learnova.audit.service.AuditService;
import com.learnova.classroom.service.ClassroomService;
import com.learnova.exam.service.ExamService;
import com.learnova.identity.service.*;
import com.learnova.session.dto.SessionDtos.*;
import com.learnova.session.entity.ExamSession;
import com.learnova.session.enums.*;
import com.learnova.session.exception.SessionFailure;
import com.learnova.session.repository.*;
import com.learnova.shared.api.*;
import java.math.BigDecimal;
import java.time.*;
import java.time.temporal.ChronoUnit;
import java.util.*;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service @Transactional(readOnly=true)
public class SessionService {
    private final SessionRepository sessions;
    private final SessionViews views;
    private final ExamService exams;
    private final ClassroomService classrooms;
    private final ParticipantDirectory participants;
    private final IdentityService identity;
    private final AuditService audit;
    private final Clock clock;
    private final org.springframework.context.ApplicationEventPublisher events;
    public SessionService(SessionRepository sessions, SessionViews views, ExamService exams, ClassroomService classrooms,
            ParticipantDirectory participants, IdentityService identity, AuditService audit, Clock clock, org.springframework.context.ApplicationEventPublisher events) {
        this.sessions=sessions; this.views=views; this.exams=exams; this.classrooms=classrooms;
        this.participants=participants; this.identity=identity; this.audit=audit; this.clock=clock; this.events=events;
    }
    public PageResponse<Detail> list(UUID actor, SessionStatus status, UUID examId, UUID classroomId, PageQuery page) {
        authorize(actor); Instant now=now();
        var result=sessions.findAll((root,q,cb)-> {
            var predicates=new ArrayList<jakarta.persistence.criteria.Predicate>();
            predicates.add(cb.equal(root.get("ownerId"),actor));
            if (examId!=null) predicates.add(cb.equal(root.get("examId"),examId));
            if (classroomId!=null) predicates.add(cb.isMember(classroomId,root.get("classroomIds")));
            if (status!=null) {
                var timed=root.get("status").in(SessionStatus.SCHEDULED,SessionStatus.OPEN);
                predicates.add(switch(status) {
                    case OPEN -> cb.and(timed,cb.lessThanOrEqualTo(root.get("startTime"),now),cb.greaterThan(root.get("endTime"),now));
                    case SCHEDULED -> cb.and(timed,cb.greaterThan(root.get("startTime"),now));
                    case CLOSED -> cb.or(cb.equal(root.get("status"),SessionStatus.CLOSED),cb.and(timed,cb.lessThanOrEqualTo(root.get("endTime"),now)));
                    default -> cb.equal(root.get("status"),status);
                });
            }
            return cb.and(predicates.toArray(jakarta.persistence.criteria.Predicate[]::new));
        },page.toPageable(Sort.by(Sort.Direction.DESC,"updatedAt","id")));
        return PageResponse.from(result.map(s->view(s,now)));
    }
    public Detail detail(UUID actor, UUID id) { return view(owned(actor,id,false),now()); }
    public record ResultRelease(Instant releasedAt) {}
    public record AssignmentChanged(UUID sessionId) {}
    @Transactional
    public ResultRelease releaseResults(UUID actor, UUID id) {
        var s=owned(actor,id,true);
        if (s.getResultReleasePolicy()!=ResultReleasePolicy.MANUAL)
            throw new SessionFailure(409,"RESULT_RELEASE_NOT_MANUAL");
        if (s.effectiveStatus(now())==SessionStatus.DRAFT || s.effectiveStatus(now())==SessionStatus.CANCELLED)
            throw new SessionFailure(409,"SESSION_INVALID_STATE");
        if (s.getResultsReleasedAt()==null) {
            s.releaseResults(now());
            record(actor,s,AuditAction.RESULT_MANUALLY_RELEASED,Map.of());
        }
        return new ResultRelease(s.getResultsReleasedAt());
    }
    public ParticipantDirectory.Participant lookup(UUID actor, String email) {
        authorize(actor); return participants.byEmail(email).orElseThrow(()->new SessionFailure(404,"PARTICIPANT_NOT_FOUND"));
    }
    @Transactional
    public Detail create(UUID actor, WriteSession input) {
        authorize(actor);
        var version=exams.requireSessionVersion(actor,input.examVersionId());
        var score=validate(actor,input,new BigDecimal(version.totalScore()));
        var s=sessions.saveAndFlush(new ExamSession(actor,version.examId(),input,score,now()));
        record(actor,s,AuditAction.SESSION_CREATED,Map.of());
        return view(s,now());
    }
    @Transactional
    public Detail update(UUID actor, UUID id, WriteSession input) {
        var s=owned(actor,id,true); Instant now=now(); checkRevision(s,input.revision());
        var actions=actions(s,now);
        if (!actions.editTitle()) throw new SessionFailure(409,"SESSION_CONFIG_LOCKED");
        if (!actions.editConfiguration()) {
            if (!sameConfiguration(s,input)) throw new SessionFailure(409,"SESSION_CONFIG_LOCKED");
            s.rename(input.title());
        } else {
            if (s.effectiveStatus(now)==SessionStatus.SCHEDULED) {
                if (!input.startTime().isAfter(now)) invalid("startTime","Thời điểm bắt đầu mới phải ở tương lai.");
                if (!input.endTime().equals(s.getEndTime())) throw new SessionFailure(409,"SESSION_USE_EXTEND_COMMAND");
            }
            var version=input.examVersionId().equals(s.getExamVersionId()) ? null : exams.requireSessionVersion(actor,input.examVersionId());
            var score=validate(actor,input,new BigDecimal(version==null?views.version(s.getExamVersionId()).totalScore():version.totalScore()));
            // Đọc lại thời gian sau khi chờ khóa Exam; không sửa cấu hình khi kỳ thi vừa mở.
            if (!actions(s,now()).editConfiguration()) throw new SessionFailure(409,"SESSION_CONFIG_LOCKED");
            s.configure(version==null?s.getExamId():version.examId(),input,score);
        }
        s.advance(now()); s.touch(now()); sessions.flush();
        events.publishEvent(new AssignmentChanged(s.getId()));
        record(actor,s,AuditAction.SESSION_UPDATED,Map.of()); return view(s,now());
    }
    @Transactional
    public Detail schedule(UUID actor, UUID id, long revision) {
        var s=owned(actor,id,true); checkRevision(s,revision);
        if (!actions(s,now()).schedule()) throw new SessionFailure(409,"SESSION_INVALID_STATE");
        var version=exams.requireSessionVersion(actor,s.getExamVersionId());
        validate(actor,input(s),new BigDecimal(version.totalScore()));
        Instant now=now();
        if (!s.getEndTime().isAfter(now)) invalid("endTime","Cửa sổ thi đã kết thúc.");
        s.schedule(now); sessions.flush(); events.publishEvent(new AssignmentChanged(s.getId())); record(actor,s,AuditAction.SESSION_SCHEDULED,Map.of()); return view(s,now);
    }
    @Transactional
    public Detail cancel(UUID actor, UUID id, long revision) {
        var s=owned(actor,id,true); checkRevision(s,revision); Instant now=now();
        if (!actions(s,now).cancel()) throw new SessionFailure(409,"SESSION_INVALID_STATE");
        s.cancel(now); sessions.flush(); record(actor,s,AuditAction.SESSION_CANCELLED,Map.of()); return view(s,now);
    }
    @Transactional
    public Detail extend(UUID actor, UUID id, Extend input) {
        var s=owned(actor,id,true); checkRevision(s,input.revision()); Instant now=now();
        if (!actions(s,now).extend()) throw new SessionFailure(409,"SESSION_INVALID_STATE");
        requirePrecision(input.newEndTime(),"newEndTime");
        if (!input.newEndTime().isAfter(s.getEndTime())) invalid("newEndTime","Giờ kết thúc mới phải lớn hơn giờ hiện tại.");
        var old=s.getEndTime(); s.advance(now); s.extend(input.newEndTime(),now); sessions.flush();
        record(actor,s,AuditAction.SESSION_END_TIME_EXTENDED,Map.of("oldEndTime",old.toString(),"newEndTime",input.newEndTime().toString()));
        return view(s,now);
    }
    private ExamSession owned(UUID actor, UUID id, boolean lock) {
        authorize(actor);
        var s=(lock?sessions.lockById(id):sessions.findByIdAndOwnerId(id,actor)).orElseThrow(()->new SessionFailure(404,"SESSION_NOT_FOUND"));
        if (!s.getOwnerId().equals(actor)) throw new SessionFailure(404,"SESSION_NOT_FOUND"); return s;
    }
    private void authorize(UUID actor) {
        if (!identity.activeUser(actor).roles().contains("CREATOR")) throw new SessionFailure(403,"FORBIDDEN");
    }
    private BigDecimal validate(UUID actor, WriteSession i, BigDecimal total) {
        requirePrecision(i.startTime(),"startTime"); requirePrecision(i.endTime(),"endTime");
        if (!i.endTime().isAfter(i.startTime())) invalid("endTime","Giờ kết thúc phải sau giờ bắt đầu.");
        if (!i.passingScore().matches("\\d+(\\.\\d+)?")) invalid("passingScore","Dùng số không âm và dấu chấm thập phân.");
        var score=new BigDecimal(i.passingScore());
        if (score.scale()>10 || score.precision()-score.scale()>20 || score.compareTo(total)>0) invalid("passingScore","Điểm đạt không được vượt tổng điểm; tối đa 10 chữ số thập phân.");
        if (new HashSet<>(i.classroomIds()).size()!=i.classroomIds().size() || new HashSet<>(i.participantIds()).size()!=i.participantIds().size()) invalid("accessType","Danh sách giao thi không được trùng lặp.");
        boolean valid=switch(i.accessType()) {
            case PUBLIC -> i.classroomIds().isEmpty() && i.participantIds().isEmpty();
            case CLASS -> !i.classroomIds().isEmpty() && i.participantIds().isEmpty();
            case INDIVIDUAL -> i.classroomIds().isEmpty() && !i.participantIds().isEmpty();
        };
        if (!valid) invalid("accessType","Chọn đúng một loại và danh sách đối tượng tương ứng.");
        i.classroomIds().forEach(id->classrooms.assignmentName(actor,id));
        i.participantIds().forEach(id->participants.byId(id).orElseThrow(()->new SessionFailure(400,"SESSION_INVALID_PARTICIPANT")));
        return score;
    }
    private boolean sameConfiguration(ExamSession s, WriteSession i) {
        var old=input(s);
        String score=i.passingScore().matches("\\d+(\\.\\d+)?")?decimal(new BigDecimal(i.passingScore())):i.passingScore();
        return new WriteSession(null,"",i.examVersionId(),i.startTime(),i.endTime(),i.durationMinutes(),i.maxAttempts(),score,i.accessType(),
                i.classroomIds().stream().sorted().toList(),i.participantIds().stream().sorted().toList(),i.shuffleQuestions(),i.shuffleAnswers(),i.resultDisplayMode(),i.resultReleasePolicy())
            .equals(new WriteSession(null,"",old.examVersionId(),old.startTime(),old.endTime(),old.durationMinutes(),old.maxAttempts(),old.passingScore(),old.accessType(),
                old.classroomIds().stream().sorted().toList(),old.participantIds().stream().sorted().toList(),old.shuffleQuestions(),old.shuffleAnswers(),old.resultDisplayMode(),old.resultReleasePolicy()));
    }
    private WriteSession input(ExamSession s) {
        return new WriteSession(s.getRevision(),s.getTitle(),s.getExamVersionId(),s.getStartTime(),s.getEndTime(),s.getDurationMinutes(),s.getMaxAttempts(),
                decimal(s.getPassingScore()),s.getAccessType(),List.copyOf(s.getClassroomIds()),List.copyOf(s.getParticipantIds()),s.isShuffleQuestions(),s.isShuffleAnswers(),s.getResultDisplayMode(),s.getResultReleasePolicy());
    }
    private Actions actions(ExamSession s, Instant now) {
        var status=s.effectiveStatus(now); boolean before=status==SessionStatus.DRAFT || status==SessionStatus.SCHEDULED;
        boolean config=before && s.getFirstAttemptAt()==null;
        return new Actions(config,before || status==SessionStatus.OPEN,config && status==SessionStatus.DRAFT,config,status==SessionStatus.SCHEDULED || status==SessionStatus.OPEN);
    }
    private Detail view(ExamSession s, Instant now) {
        var v=views.version(s.getExamVersionId());
        return new Detail(s.getId(),s.getTitle(),s.getExamId(),s.getExamVersionId(),v.examName(),v.versionNumber(),v.questionCount(),v.totalScore(),s.effectiveStatus(now),
                s.getStartTime(),s.getEndTime(),s.getDurationMinutes(),s.getMaxAttempts(),decimal(s.getPassingScore()),s.getAccessType(),
                views.classes(s.getId()),views.participants(s.getId()),s.getAccessType()==AccessType.PUBLIC?null:s.getAccessType()==AccessType.CLASS?views.classParticipantCount(s.getId()):(long)s.getParticipantIds().size(),
                s.isShuffleQuestions(),s.isShuffleAnswers(),s.getResultDisplayMode(),s.getResultReleasePolicy(),s.getFirstAttemptAt()!=null,s.getRevision(),now,s.getCreatedAt(),s.getUpdatedAt(),actions(s,now));
    }
    private void checkRevision(ExamSession s, Long revision) { if (revision==null || s.getRevision()!=revision) throw new SessionFailure(409,"SESSION_REVISION_CONFLICT"); }
    private void requirePrecision(Instant value, String field) { if (!value.equals(value.truncatedTo(ChronoUnit.MICROS))) invalid(field,"Thời gian hỗ trợ tối đa microsecond."); }
    private void invalid(String field, String message) { throw new SessionFailure(400,"VALIDATION_FAILED",List.of(new ApiProblems.FieldError(field,message))); }
    private Instant now() { return clock.instant().truncatedTo(ChronoUnit.MICROS); }
    private String decimal(BigDecimal v) { return v.stripTrailingZeros().toPlainString(); }
    private void record(UUID actor, ExamSession s, AuditAction action, Map<String,String> data) { audit.record(actor.toString(),action,"EXAM_SESSION",s.getId().toString(),data); }
}
