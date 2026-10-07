package com.learnova.notification.service;

import com.learnova.classroom.service.ClassroomService.MemberJoined;
import com.learnova.session.service.SessionService.AssignmentChanged;
import com.learnova.notification.repository.NotificationDelivery;
import java.time.Clock;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.*;

@Service
public class NotificationDeliveryService {
    private final NotificationDelivery delivery;
    private final Clock clock;
    public NotificationDeliveryService(NotificationDelivery delivery, Clock clock) { this.delivery=delivery; this.clock=clock; }
    // Listener đồng bộ tham gia transaction gốc: rollback nghiệp vụ cũng rollback thông báo.
    @EventListener @Transactional(propagation=Propagation.MANDATORY)
    public void assigned(AssignmentChanged event) { delivery.assignments(event.sessionId(),null,clock.instant()); }
    @EventListener @Transactional(propagation=Propagation.MANDATORY)
    public void joined(MemberJoined event) {
        delivery.joined(event.classroomId(),event.userId(),event.membershipId()+":"+event.joinedAt(),clock.instant());
        delivery.assignments(null,event.userId(),clock.instant());
    }
    @Transactional
    public void reconcile() {
        var now=clock.instant();
        delivery.assignments(null,null,now);
        delivery.reminders(now);
        delivery.results(now);
    }
}
